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
        prompt: `
        Analyze the spreadsheet in the data folder — for each sheet, report the total row count, whether there's a header row, the number of data rows (excluding the header), and what type of content it contains (tabular data, embedded images, etc.).
        You can leverage fs-subagent for that.
        `,
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
