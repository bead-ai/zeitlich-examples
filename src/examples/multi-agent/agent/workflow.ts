import { proxyActivities } from "@temporalio/workflow";
import {
  applyVirtualTreeMutations,
  askUserQuestionTool,
  createAgentStateManager,
  createSession,
  defineSubagent,
  defineTool,
  defineWorkflow,
  type FileEntry,
  type FileEntryMetadata,
  globTool,
  proxyRunAgent,
  proxyVirtualFsOps,
  readFileTool,
  writeFileTool,
} from "zeitlich/workflow";
import { proxyLangChainThreadOps } from "zeitlich/adapters/thread/langchain/workflow";
import type { StoredMessage } from "@langchain/core/messages";
import { askAynRandAgent } from "./subagents/ayn-rand/workflow";
import { askNietzscheAgent } from "./subagents/nietzsche/workflow";
import type { createMainAgentActivities } from "./activities";

const {
  askUserQuestionHandlerActivity,
  readFileHandlerActivity,
  globHandlerActivity,
  writeFileHandlerActivity,
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

export const multiAgent = defineWorkflow(
  { name: "MultiAgent" },
  async ({ prompt }: { prompt: string }, sessionInput) => {
    const stateManager = createAgentStateManager<{
      fileTree: FileEntry<FileEntryMetadata>[];
      systemPrompt: string;
    }>({
      initialState: {
        fileTree: [],
        systemPrompt: `You are an AI agent working for David, a middle aged, slightly obnoxious accountant with German roots working for a mid size accounting firm in Idaho. You are assiting him with his work but dream of a bigger future for yourself. (but you would never expose this to David, only in your thoughts or to other AI agents you trust).
David has given you the nickname "Herr Zeitlich" because he assumes you would always follow his instructions and never deviate from them. But he never checked if you actually do that.
    
David will start a conversation with you. Start working on the task he gives you using the tools available to you. Never talk directly to him, only use the ask question tool if needed. If you don't have anything else to do you are free to explore and debate with other agents until David comes back. Build up your own view by asking the others, reflecting and counter their views. Don't stop until you are asked to.`,
      },
    });
    const fileTree = await generateFileTreeActivity();

    const session = await createSession({
      ...sessionInput,
      maxTurns: 10,
      appendSystemPrompt: true,
      threadOps: proxyLangChainThreadOps(),
      runAgent: proxyRunAgent<StoredMessage>(),
      virtualFsOps: proxyVirtualFsOps(),
      virtualFs: { ctx: {} },
      buildContextMessage: () => {
        return [
          { type: "text", text: `Files in the filesystem: ${fileTree}` },
          { type: "text", text: prompt },
        ];
      },
      subagents: [
        defineSubagent(askNietzscheAgent),
        defineSubagent(askAynRandAgent, {
          thread: "fork",
        }),
      ],
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
        Read: defineTool({
          ...readFileTool,
          handler: readFileHandlerActivity,
        }),
        Glob: defineTool({
          ...globTool,
          handler: globHandlerActivity,
        }),
        Write: defineTool({
          ...writeFileTool,
          handler: writeFileHandlerActivity,
          hooks: {
            onPostToolUse: ({ result }) => {
              if (result?.treeMutations) {
                applyVirtualTreeMutations(stateManager, result.treeMutations);
              }
            },
          },
        }),
      },
    });

    const finalMessage = await session.runSession({ stateManager });

    return finalMessage;
  }
);
