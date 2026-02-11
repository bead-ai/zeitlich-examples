import type Redis from "ioredis";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  handleAskUserQuestionToolResult,
  handleBashTool,
  invokeModel,
} from "zeitlich";
import { type RunAgentActivity, toTree } from "zeitlich";
import { inMemoryFileSystem } from "./data";
import type { WorkflowClient } from "@temporalio/client";
export interface MainAgentActivities {
  generateFileTree: () => Promise<string>;
  /** Workflow-specific runAgent with tools pre-bound */
  runAgent: RunAgentActivity;
  handleAskUserQuestionToolResult: typeof handleAskUserQuestionToolResult;
  handleBashToolResult: ReturnType<typeof handleBashTool>;
}

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
}): MainAgentActivities => {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    maxRetries: 2,
    thinking: {
      budget_tokens: 1024,
      type: "enabled",
    },
    maxTokens: 8000,
    betas: ["advanced-tool-use-2025-11-20", "interleaved-thinking-2025-05-14"],
  });

  return {
    handleBashToolResult: handleBashTool({ fs: inMemoryFileSystem }),
    generateFileTree: async () => Promise.resolve(toTree(inMemoryFileSystem)),
    runAgent: (config) => invokeModel({ config, model, redis, client }),
    handleAskUserQuestionToolResult,
  };
};
