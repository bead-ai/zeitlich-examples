import type Redis from "ioredis";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  mapStoredMessageToChatMessage,
  type AIMessage,
  type StoredMessage,
} from "@langchain/core/messages";
import { invokeModel } from "zeitlich";
import type { RunAgentActivity } from "zeitlich";

export interface AynRandSubagentActivities {
  /** Ayn Rand-specific runAgent with no tools */
  runAynRandAgent: RunAgentActivity;
  /** Extract text content from a stored message */
  extractTextContent: (storedMessage: StoredMessage) => Promise<string | null>;
}

/**
 * Extracts text content from a StoredMessage
 */
function extractTextContent(storedMessage: StoredMessage): string | null {
  const message = mapStoredMessageToChatMessage(storedMessage) as AIMessage;
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { type: "text"; text: string } =>
          typeof part === "object" && part.type === "text"
      )
      .map((part) => part.text)
      .join("\n");
  }
  return null;
}

/**
 * Creates activities for the Ayn Rand subagent workflow.
 * No tools are bound - this agent only reflects and responds.
 */
export const createAynRandSubagentActivities = (
  redis: Redis
): AynRandSubagentActivities => {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    maxRetries: 2,
    thinking: {
      budget_tokens: 3000,
      type: "enabled",
    },
    maxTokens: 4000,
    betas: ["interleaved-thinking-2025-05-14"],
  });

  return {
    runAynRandAgent: (config, invocationConfig) =>
      invokeModel(redis, { ...config, tools: [] }, model, invocationConfig),
    extractTextContent: async (storedMessage) =>
      extractTextContent(storedMessage),
  };
};
