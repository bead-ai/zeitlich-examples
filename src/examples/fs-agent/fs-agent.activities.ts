import type { RunAgentActivity } from "zeitlich";
import { handleBashTool, invokeModel, toTree } from "zeitlich";
import type Redis from "ioredis";
import type { WorkflowClient } from "@temporalio/client";
import { ChatBedrockConverse } from "@langchain/aws";
import type { Sandbox } from "e2b";

const MAX_OUTPUT_CHARS = 16_000;

function truncate(text: string, label: string): string {
    if (text.length <= MAX_OUTPUT_CHARS) return text;
    const half = Math.floor(MAX_OUTPUT_CHARS / 2);
    const trimmed = text.length - MAX_OUTPUT_CHARS;
    return `${text.slice(0, half)}\n\n... [${label}: ${trimmed} characters truncated] ...\n\n${text.slice(-half)}`;
}

export interface FsAgentActivities {
    fsAgentRunAgent: RunAgentActivity,
    fsAgentGenerateFileTree: () => Promise<string>,
    fsAgentHandleBashToolResult: ReturnType<typeof handleBashTool>,
}

type CreateFsAgentActivitiesIn = {
    redis: Redis,
    client: WorkflowClient,
    sandbox: Sandbox,
}

export function createFsAgentActivities({ redis, client, sandbox }: CreateFsAgentActivitiesIn): FsAgentActivities {
    const model = new ChatBedrockConverse({
        model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        region: process.env.AWS_REGION || "us-east-1",
        maxTokens: 8000,
      });
      
    const E2B_API_KEY = process.env.E2B_API_KEY;
    if (!E2B_API_KEY) {
        throw new Error("E2B_API_KEY is not set in environment variables");
    }
    
    const rawBashHandler = handleBashTool(sandbox.sandboxId, E2B_API_KEY);

    return {
        fsAgentRunAgent: (config) => invokeModel({ config, model, redis, client }),
        fsAgentGenerateFileTree: async () => Promise.resolve(toTree(sandbox)),
        fsAgentHandleBashToolResult: async (args: Parameters<typeof rawBashHandler>[0], context: Parameters<typeof rawBashHandler>[1]) => {
            const result = await rawBashHandler(args, context);
            const content = typeof result.content === "string"
                ? truncate(result.content, "output")
                : result.content;
            return { ...result, content };
        },
    };
}