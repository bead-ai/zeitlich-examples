import { z } from "zod";
import type { ToolDefinition } from "zeitlich/workflow";

// Single generic tool — the agent constructs the full CLI command
// based on the agent-xlsx skill docs. The activity just executes it.
export const agentXlsxTool = {
  name: "AgentXlsx" as const,
  description: `Execute an agent-xlsx CLI command in the sandbox.

Pass the full command after "agent-xlsx" (the "agent-xlsx" prefix is added automatically).
All file paths are relative to the sandbox directory.
Returns JSON to stdout on success, or an error object on failure.`,
  schema: z.object({
    command: z
      .string()
      .describe(
        "The agent-xlsx command to run (e.g. 'probe WDIEXCEL.xlsx --full')"
      ),
  }),
  strict: true,
} satisfies ToolDefinition;
