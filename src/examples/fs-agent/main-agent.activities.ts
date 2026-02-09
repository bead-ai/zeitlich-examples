import { ChatBedrockConverse } from "@langchain/aws";
import type { RunAgentActivity} from "zeitlich";
import { toTree, invokeModel } from "zeitlich";
import type Redis from "ioredis";
import type { WorkflowClient } from "@temporalio/client";
import { OverlayFs } from "just-bash";
import { dirname } from "path";
import { fileURLToPath } from "url";

export interface MainAgentActivities {
    runAgent: RunAgentActivity;
    generateFileTree: () => Promise<string>;
}

type CreateMainAgentActivitiesIn = {
    redis: Redis,
    client: WorkflowClient,
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createMainAgentActivities({redis, client}: CreateMainAgentActivitiesIn): MainAgentActivities {
    const model = new ChatBedrockConverse({
        model: "us.anthropic.claude-opus-4-5-20251101-v1:0",
        region: process.env.AWS_REGION || "us-west-2",
        maxTokens: 8000,
        additionalModelRequestFields: {
          thinking: {
            type: "enabled",
            budget_tokens: 1024,
          },
        },
      });
      
      const fs = new OverlayFs({ root: __dirname, mountPoint: "/home/user" });
    
      return {
        generateFileTree: async () => Promise.resolve(toTree(fs)),
        runAgent: (config) => invokeModel({ config, model, redis, client }),
      };
}