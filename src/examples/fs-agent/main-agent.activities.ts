import type { RunAgentActivity} from "zeitlich";
import { invokeModel } from "zeitlich";
import { toTree } from "./utils/toTree";
import type Redis from "ioredis";
import type { WorkflowClient } from "@temporalio/client";
import type { Sandbox } from "e2b";
import { ChatAnthropic } from "@langchain/anthropic";

export interface MainAgentActivities {
    mainAgentRunAgent: RunAgentActivity;
    mainAgentGenerateFileTree: () => Promise<string>;
}

type CreateMainAgentActivitiesIn = {
    redis: Redis,
    client: WorkflowClient,
    sandbox: Sandbox,
}

export function createMainAgentActivities({ redis, client, sandbox }: CreateMainAgentActivitiesIn): MainAgentActivities {
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
        mainAgentGenerateFileTree: async () => Promise.resolve(toTree(sandbox)),
        mainAgentRunAgent: (config) => invokeModel({ config, model, redis, client }),
      };
}