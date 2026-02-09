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

export const handleBashTool: (bashToolOptions: BashToolOptions) =>
  ActivityToolHandler<bashToolSchemaType, BashExecOut | null> = (bashToolOptions: BashToolOptions) => async (args: bashToolSchemaType, _context) => {
  const { command } = args;
  const { sandboxId } = bashToolOptions;

  try {
    const sandbox = await Sandbox.connect(sandboxId);

    const commandResult = await sandbox.commands.run(command);
    const { exitCode, stderr, stdout } = commandResult;
    const bashExecOut = { exitCode, stderr, stdout };

    return {
      content: `Exit code: ${exitCode}\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`,
      result: bashExecOut,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error");
    return {
      content: `Error executing bash command: ${err.message}`,
      result: null,
    };
  }
};