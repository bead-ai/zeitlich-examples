import "dotenv/config";

import { NativeConnection, Worker } from "@temporalio/worker";
import { Client } from "@temporalio/client";
import Redis from "ioredis";
import { fileURLToPath } from "node:url";
import { ZeitlichPlugin } from "zeitlich";
import { Sandbox } from "e2b";
import dotenv from "dotenv";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "./.env") });

/* Supported workflows */
import { createMainAgentActivities } from "./main-agent.activities";
import { createFsAgentActivities } from "./fs-agent.activities";
import path from "node:path";

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

    const E2B_API_KEY = process.env.E2B_API_KEY;
    if (!E2B_API_KEY) {
        throw new Error("E2B_API_KEY is not set in environment variables");
    }

    const sandbox = await Sandbox.create('xp68wnda88nt5dl6ebl8');
    console.log(`Created sandbox: ${sandbox.sandboxId}`);

    const content = fs.readFileSync(path.resolve(__dirname, "./data.zip"));

    await sandbox.files.write('~/data.zip', content.buffer);

    await sandbox.commands.run("mkdir data");
    await sandbox.commands.run("unzip data.zip -d data");

    try {
        const worker = await Worker.create({
            plugins: [new ZeitlichPlugin({ redis })],
            connection,
            namespace: "default",
            taskQueue: "zukunft",
            workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
            activities: {
                ...createMainAgentActivities({ redis, client: client.workflow, sandbox }),
                ...createFsAgentActivities({ redis, client: client.workflow, sandbox }),
            }
        });

        await worker.run();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Something went kaboom: ${message}`);
    } finally {
        await sandbox.kill();
        connection.close();
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
})