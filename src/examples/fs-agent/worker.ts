import "dotenv/config";

import { NativeConnection, Worker } from "@temporalio/worker";
import { Client } from "@temporalio/client";
import Redis from "ioredis";
import { fileURLToPath } from "node:url";
import { ZeitlichPlugin } from "zeitlich";
import { createMainAgentActivities } from "./main-agent.activities";

async function run() {
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
            taskQueue: "zukunft",
            workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
            activities: {
                ...createMainAgentActivities({redis, client: client.workflow}),
            }
        });

        await worker.run();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Something went kaboom: ${message}`);
    } finally {
        connection.close();
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
})