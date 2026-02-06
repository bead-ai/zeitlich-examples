import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import type { StoredMessage } from "@langchain/core/messages";
import {
  createAgentStateManager,
  createSession,
  type AgentState,
} from "zeitlich/workflow";
import type { FsAgentActivities } from "./fs-agent.activities";

const {
  fsAgentRunAgent: runAgent,
  fsAgentGenerateFileTree: generateFileTree,
  fsAgentHandleBashToolResult: handleBashToolResult,
} = proxyActivities<FsAgentActivities>({
  startToCloseTimeout: "30m",
  retry: {
    maximumAttempts: 6,
    initialInterval: "5s",
    maximumInterval: "15m",
    backoffCoefficient: 4,
  },
  heartbeatTimeout: "5m",
});

export async function fsAgentWorkflow({
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
    agentName: "fs-subagent",
    maxTurns: 100,
    runAgent,
    baseSystemPrompt: `You are a filesystem specialist agent with full access to a sandboxed filesystem environment. Your role is to assist with file operations, directory management, code exploration, and any filesystem-related tasks delegated to you.

You have access to a Bash tool that allows you to execute shell commands. Use standard Unix commands like ls, cat, grep, find, mkdir, touch, cp, mv, rm, head, tail, wc, and others to accomplish your tasks.

Always be thorough and precise in your responses. When exploring files or directories, provide clear summaries of what you find. When making changes, confirm what was done.`,
    instructionsPrompt: `Complete the filesystem task you've been given. Use the Bash tool to execute commands as needed. Be methodical: first understand the current state, then perform the required operations, and finally verify the results.`,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
    buildFileTree: generateFileTree,
    buildInTools: {
      Bash: handleBashToolResult,
    },
  });

  await session.runSession({ stateManager });

  return stateManager.getCurrentState();
}
