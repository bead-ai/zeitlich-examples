import "dotenv/config";

import { Connection, Client } from "@temporalio/client";
import { loadClientConnectConfig } from "@temporalio/envconfig";
import { orchestratorWorkflow } from "./agent/workflow";
import { writeFile } from "node:fs/promises";

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

  // Save the returned Dashboard file locally
  if (result.outputFile) {
    const { filename, base64, sizeBytes } = result.outputFile;
    await writeFile(filename, Buffer.from(base64, "base64"));
    console.log(`Saved ${filename} (${sizeBytes} bytes)`);
  }

  console.log("Result:", JSON.stringify(result.message, null, 2));
}

run().catch(console.error);
