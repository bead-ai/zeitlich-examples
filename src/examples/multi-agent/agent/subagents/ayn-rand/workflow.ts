import { proxyActivities } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  defineSubagentWorkflow,
  defineSubagent,
} from "zeitlich/workflow";
import { proxyLangChainThreadOps } from "zeitlich/adapters/thread/langchain/workflow";
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

export const aynRandSubagentWorkflow = defineSubagentWorkflow(
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
      runAgent: runAynRandAgent,
      buildContextMessage: () => [{ type: "text" as const, text: prompt }],
    });

    const { finalMessage, threadId } = await session.runSession({ stateManager });

    return {
      toolResponse: finalMessage
        ? await extractTextContent(finalMessage)
        : "No response from Ayn Rand",
      data: null,
      threadId,
    };
  },
);

export const aynRandSubagent = defineSubagent(aynRandSubagentWorkflow);
