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
import { createLangChainAdapter } from "zeitlich/adapters/thread/langchain";
import { InMemorySandboxProvider } from "zeitlich/adapters/sandbox/inmemory";
import type Redis from "ioredis";

export const createMainAgentActivities = ({
  client,
  redis,
}: {
  client: WorkflowClient;
  redis: Redis;
}) => {
  const adapter = createLangChainAdapter({ redis });
  const sandboxManager = new SandboxManager(new InMemorySandboxProvider());

  return {
    ...adapter.createActivities("MultiAgent"),
    ...sandboxManager.createActivities("MultiAgent"),
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
        })
      )
    ),
    bashHandlerActivity: withSandbox(sandboxManager, bashHandler),
    askUserQuestionHandlerActivity: createAskUserQuestionHandler(),
  };
};
