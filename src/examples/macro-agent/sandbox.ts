import {
  SandboxManager,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SANDBOX_DIR = path.resolve(process.cwd(), "sandbox");

export const SANDBOX_CONFIG: SandboxRuntimeConfig = {
  network: {
    allowedDomains: [], // fully airgapped — agent-xlsx runs purely offline
    deniedDomains: [],
  },
  // No allowRead in sandbox-runtime — reads are deny-list only.
  // Writes are allow-list (deny-all by default).
  filesystem: {
    denyRead: ["~/.ssh", "~/.aws", "~/.gnupg", "~/.config", "~/.netrc"],
    allowWrite: [
      SANDBOX_DIR,
      "/tmp/agent-xlsx",
    ],
    denyWrite: [],
  },
};

/** Initialize sandbox once at worker startup */
export async function initializeSandbox(): Promise<void> {
  await SandboxManager.initialize(SANDBOX_CONFIG);
}

/** Teardown sandbox during worker graceful shutdown */
export async function teardownSandbox(): Promise<void> {
  await SandboxManager.reset();
}

/**
 * Execute an agent-xlsx command inside the sandbox.
 * cwd is always SANDBOX_DIR — agent-xlsx operates exclusively within the sandbox directory.
 */
export async function execSandboxed(command: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  const wrapped = await SandboxManager.wrapWithSandbox(command);

  const result = spawnSync("bash", ["-c", wrapped], {
    cwd: SANDBOX_DIR,
    encoding: "utf8",
    timeout: 120_000, // 2 minute timeout per command
    maxBuffer: 50 * 1024 * 1024, // 50MB stdout buffer for large exports
  });

  SandboxManager.cleanupAfterCommand();

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status,
  };
}
