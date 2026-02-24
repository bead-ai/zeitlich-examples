import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  askUserQuestionTool,
  defineTool,
  bashTool,
  type AskUserQuestionArgs,
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
  const { runId: temporalRunId } = workflowInfo();
  const stateManager = createAgentStateManager<{
    questionsAsked: AskUserQuestionArgs["questions"];
    userResponses: string[];
  }>({
    initialState: { questionsAsked: [], userResponses: [] },
    agentConfig,
  });
  const fileTree = await generateFileTreeActivity();

  const session = await createSession({
    ...agentConfig,
    threadId: temporalRunId,
    runAgent: runAgentActivity,
    buildContextMessage: () => {
      return [
        { type: "text", text: `Files in the filesystem: ${fileTree}` },
        { type: "text", text: prompt },
      ];
    },
    subagents: [nietzscheSubagent, aynRandSubagent],
    tools: {
      AskUserQuestion: defineTool({
        ...askUserQuestionTool,
        handler: askUserQuestionHandlerActivity,
        hooks: {
          onPostToolUse: ({ result }) => {
            stateManager.set(
              "questionsAsked",
              stateManager.get("questionsAsked").concat(result.questions)
            );
            stateManager.waitForInput();
          },
        },
      }),
      Bash: defineTool({
        ...bashTool,
        handler: bashHandlerActivity,
      }),
    },
    hooks: {
      onPostHumanMessageAppend: ({ message }) => {
        const text =
          typeof message === "string" ? message : JSON.stringify(message);
        stateManager.set("userResponses", [
          ...stateManager.get("userResponses"),
          text,
        ]);
      },
    },
  });

  const { finalMessage } = await session.runSession({ stateManager });

  return finalMessage;
}
