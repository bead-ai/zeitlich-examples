import { ChatBedrockConverse } from "@langchain/aws";
import type { RunAgentActivity} from "zeitlich";
import { toTree, invokeModel } from "zeitlich";
import type Redis from "ioredis";
import type { WorkflowClient } from "@temporalio/client";
import type { Sandbox } from "e2b";

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
    const model = new ChatBedrockConverse({
        model: "us.anthropic.claude-opus-4-5-20251101-v1:0",
        region: process.env.AWS_REGION || "us-east-1",
        maxTokens: 8000,
        additionalModelRequestFields: {
          thinking: {
            type: "enabled",
            budget_tokens: 1024,
          },
        },
      });
    
      return {
        mainAgentGenerateFileTree: async () => Promise.resolve(toTree(sandbox)),
        mainAgentRunAgent: (config) => invokeModel({ config, model, redis, client }),
      };
}