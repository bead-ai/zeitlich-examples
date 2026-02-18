import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import type { StoredMessage } from "@langchain/core/messages";
import {
  createAgentStateManager,
  createSession,
} from "zeitlich/workflow";
import type { FsAgentActivities } from "./fs-agent.activities";
import { bashTool } from "./tools/e2bBashTool/tool";

const {
  fsAgentRunAgent: runAgent,
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
}): Promise<string> {
  const { runId: temporalRunId } = workflowInfo();
  const stateManager = createAgentStateManager({
    chatMessages: [] as StoredMessage[],
  });

  const session = await createSession({
    threadId: temporalRunId,
    agentName: "fs-subagent",
    maxTurns: 40,
    runAgent,
    baseSystemPrompt: `You are a filesystem specialist agent with access to a sandboxed environment via a Bash tool.

CRITICAL RULES FOR CONTEXT EFFICIENCY:
- Command output is hard-limited to ~1MB and will be truncated if exceeded. ALWAYS constrain output size at the command level.
- Combine related commands into a single Bash call using && or ;
- NEVER cat entire files — use head -n 50, tail -n 50, or grep to read only what you need
- NEVER use find without -maxdepth — always limit to -maxdepth 2 or 3
- For large directories, use ls (not ls -R) and explore incrementally
- Pipe through head or tail when output could be large (e.g. grep -r ... | head -30)
- Summarize findings concisely — do not repeat raw command output in your response
- Plan your approach first, then execute with minimal commands`,
    instructionsPrompt: `Complete the filesystem task you've been given. Be efficient: batch commands, limit output size, and finish as quickly as possible. Do NOT explore more than necessary.`,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
    tools: {
      BashTool: {
        ...bashTool,
        handler: handleBashToolResult,
      },
    }
  });

 const StoredMessage = await session.runSession({ stateManager });

 const content = StoredMessage?.data.content;

 console.log('Finishing FSWorkflow. Cycle report:', stateManager.getCurrentState());

 if (content === undefined) {
  return "No text to output"
 }
  return content;
}
