import { proxyActivities } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  defineSubagentWorkflow,
  defineSubagent,
} from "zeitlich/workflow";
import { proxyLangChainThreadOps } from "zeitlich/adapters/thread/langchain/workflow";
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

export const nietzscheSubagentWorkflow = defineSubagentWorkflow(
  {
    name: agentConfig.agentName,
    description: agentConfig.description,
  },
  async (prompt, sessionInput) => {
    const stateManager = createAgentStateManager({
      initialState: {
        systemPrompt: agentConfig.systemPrompt,
      },
    });

    const session = await createSession({
      ...agentConfig,
      ...sessionInput,
      threadOps: proxyLangChainThreadOps(),
      runAgent: runNietzscheAgentActivity,
      buildContextMessage: () => [{ type: "text" as const, text: prompt }],
    });

    const { finalMessage, threadId } = await session.runSession({ stateManager });

    return {
      threadId,
      toolResponse: finalMessage
        ? await extractTextContentActivity(finalMessage)
        : "No response from Nietzsche",
      data: null,
    };
  },
);

export const nietzscheSubagent = defineSubagent(nietzscheSubagentWorkflow);
