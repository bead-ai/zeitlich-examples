import "dotenv/config";

import { Connection, Client } from "@temporalio/client";
import { loadClientConnectConfig } from "@temporalio/envconfig";
import { mainAgentWorkflow } from "./main-agent.workflow";

async function run(): Promise<void> {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection });

  const handle = await client.workflow.start(mainAgentWorkflow, {
    taskQueue: "zukunft",
    args: [
      {
        prompt: `data folder contains all the data we need. What is the period of time that this reconciliation & confirmation is covering?`,
      },
    ],
    workflowId: "workflow-" + new Date().toISOString(),
  });

  console.log(`Started workflow ${handle.workflowId}`);

  console.log(await handle.result());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
