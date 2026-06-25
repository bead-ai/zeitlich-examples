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
  type Sandbox,
  type SandboxContext,
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
    readFileHandlerActivity: virtualFsHandler(readFileHandler),
    globHandlerActivity: virtualFsHandler(globHandler),
    writeFileHandlerActivity: virtualFsHandler(writeFileHandler),
    askUserQuestionHandlerActivity: createAskUserQuestionHandler(),
  };
};
