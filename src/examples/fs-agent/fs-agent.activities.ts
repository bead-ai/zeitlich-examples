import type { RunAgentActivity} from "zeitlich";
import { handleBashTool, invokeModel, toTree } from "zeitlich";
import type Redis from "ioredis";
import type { WorkflowClient } from "@temporalio/client";
import { ChatAnthropic } from "@langchain/anthropic";
import { OverlayFs } from "just-bash";
import { dirname } from "path";
import { fileURLToPath } from "node:url";

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

      const fs = new OverlayFs({ root: __dirname, mountPoint: "/home/user" });
    
    return {
        fsAgentRunAgent: (config) => invokeModel({ config, model, redis, client }),
        fsAgentGenerateFileTree: async () => Promise.resolve(toTree(fs)),
        fsAgentHandleBashToolResult: handleBashTool({fs}),
    };
}