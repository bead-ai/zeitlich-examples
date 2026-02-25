import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  defineTool,
  defineSubagent,
} from "zeitlich/workflow";
import { agentXlsxTool } from "../tools";
import { minerSubagent } from "./subagents/miner/workflow";
import { modelerSubagent } from "./subagents/modeler/workflow";
import type { createActivities } from "./activities";
import { agentConfig } from "./config";

const {
  runAgentActivity,
  fetchAndPrepareDataset,
  agentXlsxActivity,
  readWorkspaceFileActivity,
} = proxyActivities<ReturnType<typeof createActivities>>({
  startToCloseTimeout: "30m",
  retry: {
    maximumAttempts: 6,
    initialInterval: "5s",
    maximumInterval: "15m",
    backoffCoefficient: 4,
  },
  heartbeatTimeout: "5m",
});

export async function orchestratorWorkflow({ prompt }: { prompt: string }) {
  const { runId: temporalRunId, workflowId } = workflowInfo();
  const stateManager = createAgentStateManager();
  console.log(`[Orchestrator] Starting — workflowId=${workflowId}`);

  // 1. Fetch and prepare the WDI dataset (outside agent control, not sandboxed)
  const datasetFilename = await fetchAndPrepareDataset();
  console.log(`[Orchestrator] Dataset ready: ${datasetFilename}`);

  // 2. Create the orchestrator session
  const session = await createSession({
    ...agentConfig,
    systemPrompt: `<role>You are Herr Zeitlich, the orchestrator of a multi-agent macroeconomics data pipeline.</role>

<context>The WDI dataset is ready at sandbox/${datasetFilename}. WDI data lags ~2 years — year columns exist for recent years but cells are often empty. This is normal, not a failure.</context>

<workflow>
Follow this strict sequence. Complete each step exactly once — never go back to a previous step.
1. Probe the dataset to understand its structure (sheets, column_map, row counts).
2. Delegate to DataMiner — include the requested indicator names, country codes, and the column_map. The Miner discovers the exact WDI codes from the Series sheet and saves extracted data to sandbox/data.xlsx.
3. Delegate to the Modeler — tell it to read from sandbox/data.xlsx and build Dashboard.xlsx with sections, headers, summary formulas, and formatting.
4. QA-check sandbox/Dashboard.xlsx — read it to verify data, formulas, and formatting are present.
5. Report the final result.
</workflow>

<rules>
- Call each subagent exactly once. Only retry if it returns an explicit error (file not found, invalid command). Never retry because data is lagged or some years are null.
- After the Miner returns data, move immediately to the Modeler. Do not re-run the Miner.
- The Miner saves extracted data to sandbox/data.xlsx. Tell the Modeler to read from that file — do not re-state the data in the prompt.
</rules>`,
    threadId: temporalRunId,
    runAgent: runAgentActivity,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
    subagents: [defineSubagent(minerSubagent), defineSubagent(modelerSubagent)],
    tools: {
      AgentXlsx: defineTool({
        ...agentXlsxTool,
        handler: agentXlsxActivity,
      }),
    },
  });

  console.log(`[Orchestrator] Session created, running agent loop...`);
  const agentResult = await session.runSession({ stateManager });
  console.log(`[Orchestrator] Agent loop complete`);

  // 3. Return the final Dashboard file as base64 alongside the agent result.
  //    The file is also available on disk at ./sandbox/Dashboard.xlsx.
  let dashboardFile = null;
  try {
    dashboardFile = await readWorkspaceFileActivity("Dashboard.xlsx");
    console.log(
      `[Orchestrator] Dashboard.xlsx read — ${dashboardFile.sizeBytes} bytes`
    );
  } catch {
    console.log(
      `[Orchestrator] Dashboard.xlsx not found (pipeline incomplete)`
    );
  }

  return {
    message: agentResult,
    outputFile: dashboardFile,
  };
}
