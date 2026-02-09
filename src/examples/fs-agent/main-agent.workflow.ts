import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import type { StoredMessage } from "@langchain/core/messages";
import {
  createAgentStateManager,
  createSession,
  type AgentState,
} from "zeitlich/workflow";
import type { MainAgentActivities } from "./main-agent.activities";

const {
  mainAgentRunAgent: runAgent,
  mainAgentGenerateFileTree: generateFileTree,
} = proxyActivities<MainAgentActivities>({
  startToCloseTimeout: "30m",
  retry: {
    maximumAttempts: 6,
    initialInterval: "5s",
    maximumInterval: "15m",
    backoffCoefficient: 4,
  },
  heartbeatTimeout: "5m",
});

export async function mainAgentWorkflow({
  prompt,
}: {
  prompt: string;
}): Promise<AgentState<{ chatMessages: StoredMessage[] }>> {
  const { runId: temporalRunId } = workflowInfo();
  const stateManager = createAgentStateManager({
    chatMessages: [] as StoredMessage[],
  });

  const session = await createSession({
    threadId: temporalRunId,
    agentName: "main-agent",
    maxTurns: 40,
    runAgent,
    baseSystemPrompt: 'You are a helpful LLM agent',
    instructionsPrompt: 'Start working on the tasks you are given using the tools available to you',
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
    buildFileTree: generateFileTree,
    subagents: [
        {
            name: "fs-subagent",
            description: "A subagent you can leverage to ask any filesystem related questions you'd like. Subagent has full access to the filesystem as the name implies",
            workflowType: "fsAgentWorkflow",
        }
    ],
  });

  await session.runSession({ stateManager });

  return stateManager.getCurrentState();
}
