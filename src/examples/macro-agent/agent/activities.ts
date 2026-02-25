import type Redis from "ioredis";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  mapStoredMessageToChatMessage,
  type AIMessage,
  type StoredMessage,
} from "@langchain/core/messages";
import { invokeModel, type InvokeModelConfig } from "zeitlich";
import type { WorkflowClient } from "@temporalio/client";
import { createWriteStream } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { ZipFile, Entry } from "yauzl";
import path from "node:path";
import { execSandboxed } from "../sandbox";

// Sandbox directory where all Excel files live (OS-level write isolation)
const SANDBOX_DIR = path.resolve(process.cwd(), "sandbox");

/**
 * Extract text content from a StoredMessage (for subagent return values).
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
 * Creates ALL activities for the macro-agent pipeline.
 * All three agents (orchestrator, miner, modeler) share this single factory.
 */
export const createActivities = ({
  redis,
  client,
}: {
  redis: Redis;
  client: WorkflowClient;
}) => {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    maxRetries: 2,
    maxTokens: 8000,
  });

  return {
    // ─── Dataset Fetcher ─────────────────────────────────────────────
    // Downloads the World Bank WDI ZIP and extracts the first .xlsx file found.
    // Returns the actual filename (e.g. "WDIEXCEL.xlsx") for downstream agents.
    fetchAndPrepareDataset: async (): Promise<string> => {
      await mkdir(SANDBOX_DIR, { recursive: true });

      // 1. Download ZIP using native fetch (Node 18+)
      const url = "https://databank.worldbank.org/data/download/WDI_excel.zip";
      console.log(`[fetchAndPrepareDataset] Downloading WDI ZIP from ${url}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);

      const zipPath = path.join(SANDBOX_DIR, "WDI_excel.zip");
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(zipPath, buffer);

      // 2. Extract the first .xlsx file found in the ZIP
      const yauzl = await import("yauzl");
      const extractedFilename = await new Promise<string>((resolve, reject) => {
        yauzl.open(
          zipPath,
          { lazyEntries: true },
          (err: Error | null, zipfile: ZipFile) => {
            if (err || !zipfile) return reject(err);
            zipfile.readEntry();
            zipfile.on("entry", (entry: Entry) => {
              if (entry.fileName.endsWith(".xlsx")) {
                zipfile.openReadStream(
                  entry,
                  (err2: Error | null, stream: NodeJS.ReadableStream) => {
                    if (err2 || !stream) return reject(err2);
                    const out = createWriteStream(
                      path.join(SANDBOX_DIR, entry.fileName)
                    );
                    stream.pipe(out);
                    out.on("finish", () => resolve(entry.fileName));
                  }
                );
              } else {
                zipfile.readEntry();
              }
            });
            zipfile.on("end", () =>
              reject(new Error("No .xlsx file found in ZIP"))
            );
          }
        );
      });

      console.log(`[fetchAndPrepareDataset] Extracted: ${extractedFilename}`);
      return extractedFilename;
    },

    // ─── agent-xlsx: generic CLI passthrough ─────────────────────────
    // The agent constructs the full command; we just prefix and execute.
    // JSON arguments (--json) are auto-quoted for bash safety since bare
    // brackets like [[ are interpreted as bash conditionals.
    agentXlsxActivity: async (args: { command: string }) => {
      let command = args.command;

      // Auto-quote bare --json arguments to prevent bash interpreting [[ as conditionals
      command = command.replace(
        /(--json\s+)(?!')(\[[\s\S]*\]|\{[\s\S]*\})/,
        (_, prefix, json) =>
          `${prefix}'${json.replace(/'/g, "'\\''")}'`
      );

      console.log(`[agentXlsx] Executing: agent-xlsx ${command}`);
      const { stdout, stderr, exitCode } = await execSandboxed(
        `agent-xlsx ${command}`
      );
      if (exitCode !== 0) {
        console.log(
          `[agentXlsx] FAILED (exit ${exitCode}): ${stderr.slice(0, 200)}`
        );
        return {
          toolResponse: `Error (exit ${exitCode}): ${stderr}`,
          data: null,
        };
      }
      console.log(`[agentXlsx] OK — ${stdout.length} chars returned`);
      return { toolResponse: stdout, data: null };
    },

    // ─── Read sandbox file as base64 (for returning files in workflow result) ──
    readWorkspaceFileActivity: async (filename: string) => {
      const filePath = path.join(SANDBOX_DIR, filename);
      const fileBuffer = await readFile(filePath);
      return {
        filename,
        base64: fileBuffer.toString("base64"),
        sizeBytes: fileBuffer.length,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    },

    // ─── Extract text content from StoredMessage (for subagent returns) ──
    extractTextContentActivity: async (
      storedMessage: StoredMessage
    ): Promise<string | null> => extractTextContent(storedMessage),

    // ─── Zeitlich model invocation (shared by all 3 agents) ──────────
    runAgentActivity: (config: InvokeModelConfig) =>
      invokeModel({ config, model, redis, client }),
  };
};
