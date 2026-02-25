import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  defineTool,
  type SubagentInput,
  type ToolHandlerResponse,
} from "zeitlich/workflow";
import { agentXlsxTool } from "../../../tools";
import type { createActivities } from "../../activities";
import { agentConfig } from "./config";

const { runAgentActivity, agentXlsxActivity, extractTextContentActivity } =
  proxyActivities<ReturnType<typeof createActivities>>({
    startToCloseTimeout: "10m",
    retry: {
      maximumAttempts: 3,
      initialInterval: "5s",
      maximumInterval: "2m",
      backoffCoefficient: 3,
    },
    heartbeatTimeout: "3m",
  });

// Child workflows must return { toolResponse, data } for the subagent handler
// to correctly serialize the result into the parent's thread.
export async function modelerWorkflow({
  prompt,
}: SubagentInput): Promise<ToolHandlerResponse> {
  const { runId: temporalRunId, workflowId } = workflowInfo();
  const stateManager = createAgentStateManager();
  console.log(`[Modeler] Starting — workflowId=${workflowId}`);

  const session = await createSession({
    ...agentConfig,
    threadId: temporalRunId,
    runAgent: runAgentActivity,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
    tools: {
      AgentXlsx: defineTool({
        ...agentXlsxTool,
        handler: agentXlsxActivity,
      }),
    },
  });

  const message = await session.runSession({ stateManager });
  const textContent = message
    ? await extractTextContentActivity(message)
    : null;

  const toolResponse =
    textContent ?? "Modeler completed but produced no output.";
  console.log(`[Modeler] Done — response length=${toolResponse.length} chars`);
  return { toolResponse, data: null };
}

export const modelerSubagent = {
  agentName: agentConfig.agentName,
  description: agentConfig.description,
  workflow: modelerWorkflow,
};
