import type { RunAgentActivity} from "zeitlich";
import { handleBashTool, invokeModel, toTree } from "zeitlich";
import type Redis from "ioredis";
import type { WorkflowClient } from "@temporalio/client";
import { OverlayFs } from "just-bash";
import { dirname } from "path";
import { fileURLToPath } from "node:url";
import { ChatBedrockConverse } from "@langchain/aws";

export interface FsAgentActivities {
    fsAgentRunAgent: RunAgentActivity,
    fsAgentGenerateFileTree: () => Promise<string>,
    fsAgentHandleBashToolResult: ReturnType<typeof handleBashTool>,
}

type CreateFsAgentActivitiesIn = {
    redis: Redis,
    client: WorkflowClient,
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createFsAgentActivities({ redis, client }: CreateFsAgentActivitiesIn): FsAgentActivities {
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
        fsAgentRunAgent: (config) => invokeModel({ config, model, redis, client }),
        fsAgentGenerateFileTree: async () => Promise.resolve(toTree(fs)),
        fsAgentHandleBashToolResult: handleBashTool({fs}),
    };
}