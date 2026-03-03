import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  type SubagentWorkflow,
} from "zeitlich/workflow";
import type { createNietzscheSubagentActivities } from "./activities";
import { agentConfig } from "./config";

const { runNietzscheAgentActivity, extractTextContentActivity } =
  proxyActivities<ReturnType<typeof createNietzscheSubagentActivities>>({
    startToCloseTimeout: "30m",
    retry: {
      maximumAttempts: 6,
      initialInterval: "5s",
      maximumInterval: "15m",
      backoffCoefficient: 4,
    },
    heartbeatTimeout: "5m",
  });

export const nietzscheSubagentWorkflow: SubagentWorkflow = async ({
  prompt,
}) => {
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
    runAgent: runNietzscheAgentActivity,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const { finalMessage } = await session.runSession({ stateManager });

  return {
    toolResponse: finalMessage
      ? await extractTextContentActivity(finalMessage)
      : "No response from Nietzsche",
    data: null,
  };
};

export const nietzscheSubagent = {
  agentName: agentConfig.agentName,
  description: agentConfig.description,
  workflow: nietzscheSubagentWorkflow,
};
