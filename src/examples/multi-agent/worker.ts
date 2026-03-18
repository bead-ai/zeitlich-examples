import "dotenv/config";

import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createMainAgentActivities } from "./agent/activities";
import { createNietzscheSubagentActivities } from "./agent/subagents/nietzsche/activities";
import { createAynRandSubagentActivities } from "./agent/subagents/ayn-rand/activities";
import { createLangChainAdapter } from "zeitlich/adapters/thread/langchain";
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

  const adapter = createLangChainAdapter({ redis });

  try {
    const worker = await Worker.create({
      connection,
      namespace: "default",
      taskQueue: "zeitlich",
      workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
      activities: {
        ...adapter.createActivities("multiAgentWorkflow"),
        ...adapter.createActivities("nietzscheSubagentWorkflow"),
        ...adapter.createActivities("aynRandSubagentWorkflow"),
        ...createMainAgentActivities({
          adapter,
          client: client.workflow,
        }),
        ...createNietzscheSubagentActivities({
          redis,
          client: client.workflow,
        }),
        ...createAynRandSubagentActivities({ redis, client: client.workflow }),
      },
    });

    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
