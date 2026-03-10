import { proxyActivities } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  askUserQuestionTool,
  defineTool,
  bashTool,
  proxySandboxOps,
} from "zeitlich/workflow";
import { aynRandSubagent } from "./subagents/ayn-rand/workflow";
import { nietzscheSubagent } from "./subagents/nietzsche/workflow";
import type { createMainAgentActivities } from "./activities";
import { agentConfig } from "./config";

const {
  runAgentActivity,
  askUserQuestionHandlerActivity,
  bashHandlerActivity,
  generateFileTreeActivity,
} = proxyActivities<ReturnType<typeof createMainAgentActivities>>({
  startToCloseTimeout: "30m",
  retry: {
    maximumAttempts: 6,
    initialInterval: "5s",
    maximumInterval: "15m",
    backoffCoefficient: 4,
  },
  heartbeatTimeout: "5m",
});

export async function multiAgentWorkflow({ prompt }: { prompt: string }) {
  const stateManager = createAgentStateManager({
    initialState: {
      systemPrompt: agentConfig.systemPrompt,
    },
  });
  const fileTree = await generateFileTreeActivity();

  const session = await createSession({
    ...agentConfig,
    runAgent: runAgentActivity,
    buildContextMessage: () => {
      return [
        { type: "text", text: `Files in the filesystem: ${fileTree}` },
        { type: "text", text: prompt },
      ];
    },
    sandbox: proxySandboxOps(),
    subagents: [nietzscheSubagent, aynRandSubagent],
    tools: {
      AskUserQuestion: defineTool({
        ...askUserQuestionTool,
        handler: askUserQuestionHandlerActivity,
        hooks: {
          onPostToolUse: () => {
            stateManager.waitForInput();
          },
        },
      }),
      Bash: defineTool({
        ...bashTool,
        handler: bashHandlerActivity,
      }),
    },
  });

  const finalMessage = await session.runSession({ stateManager });

  return finalMessage;
}
