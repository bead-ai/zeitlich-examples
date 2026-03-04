import type Redis from "ioredis";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  createAskUserQuestionHandler,
  createBashHandler,
  createRunAgentActivity,
} from "zeitlich";
import { toTree } from "zeitlich";
import { inMemoryFileSystem } from "./data";
import type { WorkflowClient } from "@temporalio/client";
import { createLangChainAdapter } from "zeitlich/adapters/langchain";
/**
 * Creates activities for the main agent workflow
 * Tools and model are bound at activity creation time, not passed per-call
 */
export const createMainAgentActivities = ({
  redis,
  client,
}: {
  redis: Redis;
  client: WorkflowClient;
}) => {
  const { threadOps, createModelInvoker } = createLangChainAdapter({
    redis,
  });

  return {
    ...threadOps,
    generateFileTreeActivity: async () =>
      Promise.resolve(toTree(inMemoryFileSystem)),
    runAgentActivity: createRunAgentActivity(
      client,
      createModelInvoker(
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
    bashHandlerActivity: createBashHandler({ fs: inMemoryFileSystem }),
    askUserQuestionHandlerActivity: createAskUserQuestionHandler(),
  };
};
