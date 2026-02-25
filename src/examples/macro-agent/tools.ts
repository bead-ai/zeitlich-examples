import { z } from "zod";
import type { ToolDefinition } from "zeitlich/workflow";

// Single generic tool — the agent constructs the full CLI command
// based on the agent-xlsx skill docs. The activity just executes it.
export const agentXlsxTool = {
  name: "AgentXlsx" as const,
  description: `Execute an agent-xlsx CLI command in the sandbox.

Pass the full command after "agent-xlsx" (the "agent-xlsx" prefix is added automatically).
All file paths are relative to the sandbox directory.

Examples:
- probe WDIEXCEL.xlsx
- search WDIEXCEL.xlsx "GDP growth" --sheet Series --columns "Indicator Name" --limit 5
- read WDIEXCEL.xlsx "A1:D10,BF1:BP10" --sheet Data
- write Dashboard.xlsx "A1" --json '[[...]]' --formula
- format Dashboard.xlsx "A1:M1" --font '{"bold": true}'
- recalc Dashboard.xlsx

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
