import { ChatAnthropic } from "@langchain/anthropic";
import {
  createAskUserQuestionHandler,
  createRunAgentActivity,
  createVirtualFsActivities,
  globHandler,
  readFileHandler,
  withVirtualFs,
  writeFileHandler,
  type ActivityToolHandler,
  type FileEntryMetadata,
  type FileReadArgs,
  type FileWriteArgs,
  type GlobArgs,
  type JsonValue,
  type RouterContext,
  type Sandbox,
  type SandboxContext,
  type TreeMutation,
} from "zeitlich";
import {
  fileSystemData,
  inMemoryFileResolver,
  type FileSystemContext,
} from "./data";
import type { WorkflowClient } from "@temporalio/client";
import { createLangChainAdapter } from "zeitlich/adapters/thread/langchain";
import type { RedisClientType } from "redis";

const SCOPE = "MultiAgent";

/** Tree mutations surfaced by `withVirtualFs` so writes persist into state. */
export interface FileMutationResult {
  treeMutations: TreeMutation[];
}

/**
 * Public type for the virtual-fs tool activities. The built-in handler result
 * types aren't exported by zeitlich, so we project them onto nameable types to
 * keep the inferred activity signatures portable across the workflow boundary.
 */
type FileToolActivity<TArgs, TData> = ActivityToolHandler<
  TArgs,
  TData,
  RouterContext,
  JsonValue | string
>;

export const createMainAgentActivities = ({
  client,
  redis,
}: {
  client: WorkflowClient;
  redis: RedisClientType;
}) => {
  const adapter = createLangChainAdapter({ redis });

  /**
   * Adapts the built-in sandbox-backed file tool handlers to the in-memory
   * virtual filesystem. `withVirtualFs` resolves an ephemeral filesystem from
   * the workflow's file tree and exposes it via `ctx.virtualFs`; the built-in
   * handlers only ever read `ctx.sandbox.fs`, so we pass the virtual
   * filesystem through under that key.
   */
  const virtualFsHandler = <TArgs, TResult, TResponse>(
    handler: ActivityToolHandler<TArgs, TResult, SandboxContext, TResponse>
  ) =>
    withVirtualFs<
      TArgs,
      TResult,
      FileSystemContext,
      FileEntryMetadata,
      TResponse
    >(client, inMemoryFileResolver, (args, ctx) =>
      handler(args, {
        ...ctx,
        sandboxId: "virtual",
        sandbox: { fs: ctx.virtualFs } as unknown as Sandbox,
      })
    );

  return {
    ...adapter.createActivities(SCOPE),
    ...createVirtualFsActivities(inMemoryFileResolver, SCOPE),
    ...createRunAgentActivity(
      client,
      adapter.createModelInvoker(
        new ChatAnthropic({
          model: "claude-sonnet-4-6",
          maxRetries: 2,
          thinking: {
            budget_tokens: 1024,
            type: "enabled",
          },
          maxTokens: 4000,
          betas: ["interleaved-thinking-2025-05-14"],
        })
      ),
      SCOPE
    ),
    generateFileTreeActivity: async () =>
      Object.keys(fileSystemData)
        .sort()
        .map((p) => `  ${p}`)
        .join("\n"),
    readFileHandlerActivity: virtualFsHandler(
      readFileHandler
    ) as unknown as FileToolActivity<FileReadArgs, JsonValue>,
    globHandlerActivity: virtualFsHandler(
      globHandler
    ) as unknown as FileToolActivity<GlobArgs, JsonValue>,
    writeFileHandlerActivity: virtualFsHandler(
      writeFileHandler
    ) as unknown as FileToolActivity<FileWriteArgs, FileMutationResult | null>,
    askUserQuestionHandlerActivity: createAskUserQuestionHandler(),
  };
};
