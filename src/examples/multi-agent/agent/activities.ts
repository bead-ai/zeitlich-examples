import { ChatAnthropic } from "@langchain/anthropic";
import {
  createAskUserQuestionHandler,
  bashHandler,
  SandboxManager,
  withSandbox,
  createRunAgentActivity,
} from "zeitlich";
import { fileSystemData } from "./data";
import type { WorkflowClient } from "@temporalio/client";
import type { LangChainAdapter } from "zeitlich/adapters/thread/langchain";
import { InMemorySandboxProvider } from "zeitlich/adapters/sandbox/inmemory";

export const createMainAgentActivities = ({
  adapter,
  client,
}: {
  adapter: LangChainAdapter;
  client: WorkflowClient;
}) => {
  const sandboxManager = new SandboxManager(new InMemorySandboxProvider());

  return {
    ...sandboxManager.createActivities("multiAgentWorkflow"),
    generateFileTreeActivity: async () =>
      Object.keys(fileSystemData)
        .sort()
        .map((p) => `  ${p}`)
        .join("\n"),
    runAgentActivity: createRunAgentActivity(
      client,
      adapter.createModelInvoker(
        new ChatAnthropic({
          model: "claude-sonnet-4-6",
          maxRetries: 2,
          thinking: {
            budget_tokens: 1024,
            type: "enabled",
          },
          maxTokens: 4000,
          betas: ["interleaved-thinking-2025-05-14"],
        }),
      ),
    ),
    bashHandlerActivity: withSandbox(sandboxManager, bashHandler),
    askUserQuestionHandlerActivity: createAskUserQuestionHandler(),
  };
};
