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

If **zeitlich** is not yet published, use a local path or workspace (e.g. `"zeitlich": "file:../zeitlich"` in `package.json`).

Set `ANTHROPIC_API_KEY` (or your LLM provider) and optionally override Temporal/Redis in `.env` as needed.

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

A multi-agent debate system with a main orchestrator and two sub-agent philosophers (Nietzsche and Ayn Rand).

- **`main-agent.workflow.ts`** – orchestrates the conversation, delegates to sub-agents
- **`nietzsche.workflow.ts`** / **`ayn-rand.workflow.ts`** – sub-agent workflows with distinct personalities
- **`*.activities.ts`** – LLM calls and tool handlers
- **`worker.ts`** – registers workflows/activities with the Zeitlich plugin
- **`start.ts`** – client script to trigger the workflow

The app uses the published **zeitlich** package; workflow code imports from `zeitlich/workflow`, activities and worker from `zeitlich`.

## Docs

- [Zeitlich on npm](https://www.npmjs.com/package/zeitlich)
- [Temporal docs](https://docs.temporal.io)

## License

MIT
