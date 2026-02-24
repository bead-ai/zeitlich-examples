import type Redis from "ioredis";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  createAskUserQuestionHandler,
  createBashHandler,
  invokeModel,
  type InvokeModelConfig,
} from "zeitlich";
import { toTree } from "zeitlich";
import { inMemoryFileSystem } from "./data";
import type { WorkflowClient } from "@temporalio/client";
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
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    maxRetries: 2,
    thinking: {
      budget_tokens: 1024,
      type: "enabled",
    },
    maxTokens: 4000,
    betas: ["advanced-tool-use-2025-11-20", "interleaved-thinking-2025-05-14"],
  });

  // Async wrapper: ToolHandler returns sync-or-async, Temporal requires Promise
  const askQuestionHandler = createAskUserQuestionHandler();

  return {
    generateFileTreeActivity: async () =>
      Promise.resolve(toTree(inMemoryFileSystem)),
    runAgentActivity: (config: InvokeModelConfig) =>
      invokeModel({ config, model, redis, client }),
    bashHandlerActivity: createBashHandler({ fs: inMemoryFileSystem }),
    askUserQuestionHandlerActivity: async (
      ...args: Parameters<typeof askQuestionHandler>
    ) => askQuestionHandler(...args),
  };
};
