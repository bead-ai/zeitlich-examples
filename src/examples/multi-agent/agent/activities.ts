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
  return {
    generateFileTreeActivity: async () =>
      Promise.resolve(toTree(inMemoryFileSystem)),
    runAgentActivity: (config: InvokeModelConfig) => {
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-6",
        maxRetries: 2,
        thinking: {
          budget_tokens: 1024,
          type: "enabled",
        },
        maxTokens: 4000,
        betas: ["interleaved-thinking-2025-05-14"],
      });

      return invokeModel({ config, model, redis, client });
    },
    bashHandlerActivity: createBashHandler({ fs: inMemoryFileSystem }),
    askUserQuestionHandlerActivity: createAskUserQuestionHandler(),
  };
};
