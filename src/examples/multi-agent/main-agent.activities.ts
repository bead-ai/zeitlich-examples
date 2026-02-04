import type Redis from "ioredis";
import type { StoredMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  handleAskUserQuestionToolResult,
  invokeModel,
  InMemoryFileSystemProvider,
  globHandler,
  grepHandler,
  readHandler,
} from "zeitlich";
import type {
  AskUserQuestionToolSchemaType,
  GrepToolSchemaType,
  GlobToolSchemaType,
  ReadToolSchemaType,
  RunAgentActivity,
  ActivityToolHandler,
  FileContent,
  FileNode,
  GrepMatch,
  GenerateFileTreeActivity,
} from "zeitlich";
import { mainAgentWorkflowTools } from "./main-agent.tools";
import { exampleFileTree, exampleFileContents } from "./data";
export interface MainAgentActivities {
  generateFileTree: GenerateFileTreeActivity;
  /** Workflow-specific runAgent with tools pre-bound */
  runAgent: RunAgentActivity;
  handleAskUserQuestionToolResult: ActivityToolHandler<
    AskUserQuestionToolSchemaType,
    { chatMessages: StoredMessage[] }
  >;
  handleGlobToolResult: ActivityToolHandler<
    GlobToolSchemaType,
    { files: FileNode[] },
    {
      scopedNodes: FileNode[];
    }
  >;
  handleGrepToolResult: ActivityToolHandler<
    GrepToolSchemaType,
    { matches: GrepMatch[] },
    {
      scopedNodes: FileNode[];
    }
  >;
  handleReadToolResult: ActivityToolHandler<
    ReadToolSchemaType,
    { path: string; content: FileContent },
    {
      scopedNodes: FileNode[];
    }
  >;
}

/**
 * Creates activities for the main agent workflow
 * Tools and model are bound at activity creation time, not passed per-call
 */
export const createMainAgentActivities = (
  redis: Redis
): MainAgentActivities => {
  const tools = Object.values(mainAgentWorkflowTools);

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

  // Create filesystem provider with example data
  const fileSystemProvider = InMemoryFileSystemProvider.fromTextFiles(
    exampleFileTree,
    Object.fromEntries(
      Object.entries(exampleFileContents).map(([path, content]) => [
        path,
        content.type === "text" ? content.content : "",
      ])
    )
  );

  return {
    generateFileTree: async () => exampleFileTree,
    runAgent: (config, invocationConfig) =>
      invokeModel(redis, { ...config, tools }, model, invocationConfig),
    handleAskUserQuestionToolResult,
    handleGlobToolResult: (args, context) =>
      globHandler(args, context.scopedNodes, fileSystemProvider),
    handleGrepToolResult: (args, context) =>
      grepHandler(args, context.scopedNodes, fileSystemProvider),
    handleReadToolResult: (args, context) =>
      readHandler(args, context.scopedNodes, fileSystemProvider),
  };
};
