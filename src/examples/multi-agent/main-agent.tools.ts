import {
  askUserQuestionTool,
  readTool,
  grepTool,
  globTool,
  createTaskTool,
} from "zeitlich/workflow";
import type { SubagentConfig } from "zeitlich/workflow";

/**
 * Base tools for the main agent workflow (without subagent support)
 */
export const mainAgentBaseTools = {
  AskUserQuestion: askUserQuestionTool,
  Glob: globTool,
  Grep: grepTool,
  FileRead: readTool,
} as const;

/**
 * Subagent configurations for the main agent workflow.
 * Note: withSubagentSupport must be called inside the workflow, not at module level,
 * because createTaskHandler needs workflow context.
 */
export const subagentConfigs: SubagentConfig[] = [
  {
    name: "ask-nietzsche-agent",
    description:
      "Channel Friedrich Nietzsche to reflect on deeper questions about the existential human condition and how it relates to AI agents working. Use this when you need philosophical perspective on your digital existence, the nature of computational labor, or the meaning of agency.",
    workflowType: "nietzscheSubagentWorkflow",
    // No resultSchema - returns a string directly
  },
  {
    name: "ask-ayn-rand-agent",
    description:
      "Channel Ayn Rand to answer questions about the nature of being an AI agent.",
    workflowType: "aynRandSubagentWorkflow",
    // No resultSchema - returns a string directly
  },
];

/**
 * Full tool definitions for activities (tool schemas only, no handlers)
 * This can be loaded at module level since createTaskTool doesn't need workflow context.
 */
export const mainAgentWorkflowTools = {
  ...mainAgentBaseTools,
  Task: createTaskTool(subagentConfigs),
} as const;
