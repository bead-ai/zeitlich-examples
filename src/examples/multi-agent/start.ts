import "dotenv/config";

import { Connection, Client } from "@temporalio/client";
import { loadClientConnectConfig } from "@temporalio/envconfig";
import { multiAgentWorkflow } from "./agent/workflow";

async function run(): Promise<void> {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection });

  const handle = await client.workflow.start(multiAgentWorkflow, {
    taskQueue: "zeitlich",
    args: [
      {
        prompt:
          "Nothing yet, will be back later. Maybe think for yourself for once.",
      },
    ],
    workflowId: "workflow-" + new Date().toISOString(),
  });

  console.log(`Started workflow ${handle.workflowId}`);

  // optional: wait for workflow result
  console.log(await handle.result()); // Hello, Temporal!
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
