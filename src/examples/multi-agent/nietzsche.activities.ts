import type Redis from "ioredis";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  mapStoredMessageToChatMessage,
  type AIMessage,
  type StoredMessage,
} from "@langchain/core/messages";
import { invokeModel } from "zeitlich";
import type { RunAgentActivity } from "zeitlich";
import type { WorkflowClient } from "@temporalio/client";

export interface NietzscheSubagentActivities {
  /** Nietzsche-specific runAgent with no tools */
  runNietzscheAgent: RunAgentActivity;
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
 * Creates activities for the Nietzsche subagent workflow.
 * No tools are bound - this agent only reflects and responds.
 */
export const createNietzscheSubagentActivities = ({
  redis,
  client,
}: {
  redis: Redis;
  client: WorkflowClient;
}): NietzscheSubagentActivities => {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    maxRetries: 2,
    thinking: {
      budget_tokens: 2000,
      type: "enabled",
    },
    maxTokens: 3000,
    betas: ["interleaved-thinking-2025-05-14"],
  });

  return {
    runNietzscheAgent: (config) =>
      invokeModel({ config, model, redis, client }),
    extractTextContent: async (storedMessage) =>
      extractTextContent(storedMessage),
  };
};
