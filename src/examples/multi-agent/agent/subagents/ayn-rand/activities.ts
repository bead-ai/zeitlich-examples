import type Redis from "ioredis";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  mapStoredMessageToChatMessage,
  type AIMessage,
  type StoredMessage,
} from "@langchain/core/messages";
import { invokeModel } from "zeitlich";
import type { InvokeModelConfig } from "zeitlich";
import type { WorkflowClient } from "@temporalio/client";

/**
 * Extracts text content from a StoredMessage
 */
function extractTextContent(storedMessage: StoredMessage): string {
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
  } else {
    throw new Error("Invalid content");
  }
}

/**
 * Creates activities for the Ayn Rand subagent workflow.
 * No tools are bound - this agent only reflects and responds.
 */
export const createAynRandSubagentActivities = ({
  redis,
  client,
}: {
  redis: Redis;
  client: WorkflowClient;
}) => {
  return {
    runAynRandAgent: (config: InvokeModelConfig) => {
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-6",
        maxRetries: 2,
        thinking: {
          budget_tokens: 3000,
          type: "enabled",
        },
        maxTokens: 4000,
        betas: ["interleaved-thinking-2025-05-14"],
      });

      return invokeModel({ config, model, redis, client });
    },
    extractTextContent: async (storedMessage: StoredMessage) =>
      extractTextContent(storedMessage),
  };
};
