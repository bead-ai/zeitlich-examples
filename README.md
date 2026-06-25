# Zeitlich Examples

Example applications for [Zeitlich](https://www.npmjs.com/package/zeitlich) – durable AI agents for [Temporal](https://temporal.io).

## Prerequisites

- Node.js >= 18
- [Temporal server](https://docs.temporal.io/self-hosted) (local dev: `temporal server start-dev`)
- Redis

## Setup

```bash
npm install
```

Create a `.env` file with your API key and optionally override Temporal/Redis settings:

```bash
ANTHROPIC_API_KEY=sk-...
# TEMPORAL_ADDRESS=localhost:7233
# REDIS_HOST=localhost
# REDIS_PORT=6379
```

## Run

1. **Start Temporal** (if not already running):

   ```bash
   npm run dev:temporal
   ```

2. **Start the worker** (in another terminal):

   ```bash
   npm run worker:multi-agent
   ```

3. **Trigger a workflow** (in another terminal):

   ```bash
   npm run start:multi-agent
   ```

## Scripts

| Script                    | Description                        |
| ------------------------- | ---------------------------------- |
| `dev:temporal`            | Start Temporal dev server          |
| `worker:multi-agent`      | Run the multi-agent worker (watch) |
| `start:multi-agent`       | Start the multi-agent workflow     |
| `typecheck`               | Run TypeScript check               |
| `lint` / `lint:fix`       | ESLint                             |
| `format` / `format:check` | Prettier                           |

## Examples

### Multi-Agent (`src/examples/multi-agent/`)

A multi-agent debate system with a main orchestrator ("Herr Zeitlich") and two subagent philosophers (Nietzsche and Ayn Rand). Demonstrates tools, subagent delegation, state management, and a virtual filesystem backed by an in-memory data layer.

```
src/examples/multi-agent/
├── workflows.ts                        # Re-exports all workflows
├── worker.ts                           # Registers workflows/activities, node-redis client
├── start.ts                            # Client script to trigger the workflow
└── agent/
    ├── workflow.ts                      # Main orchestrator workflow
    ├── activities.ts                    # LLM invocation + virtual-fs tool handlers
    ├── data.ts                          # In-memory FileResolver (invoices, clients, etc.)
    └── subagents/
        ├── nietzsche/
        │   ├── workflow.ts              # Subagent workflow (returns text via Stored message)
        │   └── activities.ts            # Subagent LLM invocation
        └── ayn-rand/
            ├── workflow.ts
            └── activities.ts
```

Key patterns demonstrated:

- **`createLangChainAdapter({ redis })`** for Redis-backed thread persistence (node-redis client)
- **`createRunAgentActivity(client, invoker, scope)`** + **`proxyRunAgent<StoredMessage>()`** to wire the agent loop
- **`createVirtualFsActivities()`** / **`proxyVirtualFsOps()`** with a custom **`FileResolver`**
- **`withVirtualFs()`** to back the built-in `Read` / `Glob` / `Write` tool handlers with an in-memory filesystem
- **`applyVirtualTreeMutations()`** to persist file writes into workflow state
- **`defineTool()`** with per-tool `hooks` for state updates
- **`createSession()`** with `subagents`, `buildContextMessage`, and `systemPrompt`
- **`defineSubagent()`** with `thread: "fork"` for forked subagent threads

The app uses the published **zeitlich** package; workflow code imports from `zeitlich/workflow`, activities and worker from `zeitlich`.

## Docs

- [Zeitlich on npm](https://www.npmjs.com/package/zeitlich)
- [Temporal docs](https://docs.temporal.io)

## License

MIT
