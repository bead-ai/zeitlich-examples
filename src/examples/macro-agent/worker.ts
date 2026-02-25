import "dotenv/config";

import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createActivities } from "./agent/activities";
import { initializeSandbox, teardownSandbox } from "./sandbox";
import { ZeitlichPlugin } from "zeitlich";
import Redis from "ioredis";
import { Client } from "@temporalio/client";

async function run(): Promise<void> {
  // 1. Initialize sandbox BEFORE starting the worker
  await initializeSandbox();
  console.log("Sandbox initialized");

  // 2. Connect to infrastructure
  const redis = new Redis({
    host: "localhost",
    port: 6379,
    username: "default",
  });
  const connection = await NativeConnection.connect({
    address: "localhost:7233",
  });
  const client = new Client({ connection });

  try {
    // 3. Create worker
    const worker = await Worker.create({
      plugins: [new ZeitlichPlugin({ redis })],
      connection,
      namespace: "default",
      taskQueue: "macro-agent",
      // Workflows are registered using a path as they run in a separate JS context.
      workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
      activities: createActivities({
        redis,
        client: client.workflow,
      }),
    });

    // 4. Graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down...");
      await worker.shutdown();
      await teardownSandbox();
      await redis.quit();
      await connection.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // 5. Start
    console.log("Worker started on task queue: macro-agent");
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
