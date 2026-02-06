import { ChatAnthropic } from "@langchain/anthropic";
import type { RunAgentActivity} from "zeitlich";
import { handleBashTool, toTree, invokeModel } from "zeitlich";
import type Redis from "ioredis";
import type { WorkflowClient } from "@temporalio/client";
import { OverlayFs } from "just-bash";
import { dirname } from "path";
import { fileURLToPath } from "url";

export interface MainAgentActivities {
    runAgent: RunAgentActivity;
    generateFileTree: () => Promise<string>;
    handleBashToolResult: ReturnType<typeof handleBashTool>;
}

type CreateMainAgentActivitiesIn = {
    redis: Redis,
    client: WorkflowClient,
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createMainAgentActivities({redis, client}: CreateMainAgentActivitiesIn): MainAgentActivities {
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
      
      // should we instantiate here?
      const fs = new OverlayFs({ root: __dirname, mountPoint: "/home/user" });
    
      return {
        handleBashToolResult: handleBashTool(fs),
        generateFileTree: async () => Promise.resolve(toTree(fs)),
        runAgent: (config) => invokeModel({ config, model, redis, client }),
      };
}