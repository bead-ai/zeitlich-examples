import "dotenv/config";

import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createMainAgentActivities } from "./agent/activities";
import { createNietzscheSubagentActivities } from "./agent/subagents/nietzsche/activities";
import { createAynRandSubagentActivities } from "./agent/subagents/ayn-rand/activities";
import { createClient, type RedisClientType } from "redis";
import { Client } from "@temporalio/client";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });
  const client = new Client({ connection });

  const redis: RedisClientType = createClient({
    socket: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });
  await redis.connect();

  try {
    const worker = await Worker.create({
      connection,
      namespace: "default",
      taskQueue: "zeitlich",
      workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
      activities: {
        ...createMainAgentActivities({
          redis,
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
    await redis.quit();
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
