import type { ActivityToolHandler } from "zeitlich/workflow";
import type { bashToolSchemaType } from "./tool";
import { Sandbox } from "e2b";

type BashExecOut = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

type BashToolOptions = {
  sandboxId: string,
}

// Conservative limit to stay well under Temporal's 4MB gRPC payload cap,
// leaving room for the rest of the message envelope.
const MAX_OUTPUT_CHARS = 1_000_000; // ~1MB

function truncate(text: string, label: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return { text, truncated: false };
  }
  const half = Math.floor(MAX_OUTPUT_CHARS / 2);
  const omitted = text.length - MAX_OUTPUT_CHARS;
  return {
    text: `${text.slice(0, half)}\n\n... [${label} truncated — ${omitted} characters omitted] ...\n\n${text.slice(-half)}`,
    truncated: true,
  };
}

export const handleBashTool: (bashToolOptions: BashToolOptions) =>
  ActivityToolHandler<bashToolSchemaType, BashExecOut | null> = (bashToolOptions: BashToolOptions) => async (args: bashToolSchemaType, _context) => {
  const { command } = args;
  const { sandboxId } = bashToolOptions;

  try {
    const sandbox = await Sandbox.connect(sandboxId);

    const commandResult = await sandbox.commands.run(command, { timeoutMs: 0 });
    const { exitCode, stderr, stdout } = commandResult;

    const stdoutResult = truncate(stdout, "stdout");
    const stderrResult = truncate(stderr, "stderr");

    const truncationWarning = (stdoutResult.truncated || stderrResult.truncated)
      ? "\n\n⚠️ Output was truncated because it exceeded the size limit. Use head, tail, or grep to narrow the output."
      : "";

    return {
      toolResponse: `Exit code: ${exitCode}\n\nstdout:\n${stdoutResult.text}\n\nstderr:\n${stderrResult.text}${truncationWarning}`,
      data: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error");
    return {
      toolResponse: `Error executing bash command: ${err.message}`,
      data: null,
    };
  }
};