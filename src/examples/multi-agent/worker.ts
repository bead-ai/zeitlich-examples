import "dotenv/config";

import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createMainAgentActivities } from "./agent/activities";
import { createNietzscheSubagentActivities } from "./agent/subagents/nietzsche/activities";
import { createAynRandSubagentActivities } from "./agent/subagents/ayn-rand/activities";
import { ZeitlichPlugin } from "zeitlich";
import Redis from "ioredis";
import { Client } from "@temporalio/client";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: "localhost:7233",
  });
  const client = new Client({ connection });

  const redis = new Redis({
    host: "localhost",
    port: 6379,
    username: "default",
  });

  try {
    const worker = await Worker.create({
      plugins: [new ZeitlichPlugin({ redis })],
      connection,
      namespace: "default",
      taskQueue: "zeitlich",
      // Workflows are registered using a path as they run in a separate JS context.
      workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
      activities: {
        ...createMainAgentActivities({ redis, client: client.workflow }),
        ...createNietzscheSubagentActivities({ redis, client: client.workflow }),
        ...createAynRandSubagentActivities({ redis, client: client.workflow }),
      },
    });

    await worker.run();
  } finally {
    // Close the connection once the worker has stopped
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
