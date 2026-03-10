import { proxyActivities } from "@temporalio/workflow";
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
  const stateManager = createAgentStateManager({
    initialState: {
      systemPrompt: agentConfig.systemPrompt,
    },
  });

  const session = await createSession({
    ...agentConfig,
    runAgent: runNietzscheAgentActivity,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const { finalMessage, threadId } = await session.runSession({ stateManager });

  return {
    threadId,
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
