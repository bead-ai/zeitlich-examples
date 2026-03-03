import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  type SubagentWorkflow,
} from "zeitlich/workflow";
import type { createAynRandSubagentActivities } from "./activities";
import { agentConfig } from "./config";

const { runAynRandAgent, extractTextContent } = proxyActivities<
  ReturnType<typeof createAynRandSubagentActivities>
>({
  startToCloseTimeout: "30m",
  retry: {
    maximumAttempts: 6,
    initialInterval: "5s",
    maximumInterval: "15m",
    backoffCoefficient: 4,
  },
  heartbeatTimeout: "5m",
});

export const aynRandSubagentWorkflow: SubagentWorkflow = async ({ prompt }) => {
  const { runId: temporalRunId } = workflowInfo();

  const stateManager = createAgentStateManager({
    initialState: {
      systemPrompt: agentConfig.systemPrompt,
    },
    agentName: agentConfig.agentName,
  });

  const session = await createSession({
    ...agentConfig,
    threadId: temporalRunId,
    runAgent: runAynRandAgent,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const { finalMessage } = await session.runSession({ stateManager });
  return {
    toolResponse: finalMessage
      ? await extractTextContent(finalMessage)
      : "No response from Ayn Rand",
    data: null,
  };
};

export const aynRandSubagent = {
  agentName: agentConfig.agentName,
  description: agentConfig.description,
  workflow: aynRandSubagentWorkflow,
};
