import "dotenv/config";

import { NativeConnection, Worker } from "@temporalio/worker";
import { createMainAgentActivities } from "./main-agent.activities";
import { createNietzscheSubagentActivities } from "./nietzsche.activities";
import { createAynRandSubagentActivities } from "./ayn-rand.activities";
import { ZeitlichPlugin } from "zeitlich";
import Redis from "ioredis";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: "localhost:7233",
  });

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
      workflowsPath: require.resolve("./workflows"),
      activities: {
        ...createMainAgentActivities(redis),
        ...createNietzscheSubagentActivities(redis),
        ...createAynRandSubagentActivities(redis),
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
