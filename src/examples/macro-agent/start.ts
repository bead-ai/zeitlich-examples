import "dotenv/config";

import { Connection, Client } from "@temporalio/client";
import { loadClientConnectConfig } from "@temporalio/envconfig";
import { orchestratorWorkflow } from "./agent/workflow";

async function run(): Promise<void> {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection });

  const handle = await client.workflow.start(orchestratorWorkflow, {
    taskQueue: "macro-agent",
    workflowId: `macro-agent-${Date.now()}`,
    // Allow more time per workflow task — replay grows as child workflows accumulate events
    workflowTaskTimeout: "30s",
    args: [
      {
        prompt:
          "Build an economic health card comparing the United Kingdom and Germany over the last 10 years — GDP growth and inflation. Output a formatted Dashboard.xlsx.",
      },
    ],
  });

  console.log(`Workflow started: ${handle.workflowId}`);
  const result = await handle.result();
  console.log("Result:", JSON.stringify(result.message, null, 2));
}

run().catch(console.error);
