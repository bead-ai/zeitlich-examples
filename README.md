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

2. **Start the worker**:

   ```bash
   npm run dev:worker
   ```

3. **Trigger a workflow** (in another terminal):

   ```bash
   npm run workflow
   ```

## Scripts

| Script                    | Description                    |
| ------------------------- | ------------------------------ |
| `dev:temporal`            | Start Temporal dev server      |
| `dev:worker`              | Run the example worker (watch) |
| `workflow`                | Start the example workflow     |
| `typecheck`               | Run TypeScript check           |
| `lint` / `lint:fix`       | ESLint                         |
| `format` / `format:check` | Prettier                       |

## Project layout

- `src/example/` – example workflows, activities, tools, and worker
  - **Workflows**: main agent (`workflow.ts`), Nietzsche and Ayn Rand subagent workflows
  - **Activities**: LLM and tool handlers
  - **Worker**: registers workflows and activities with the Zeitlich plugin

The app uses the published **zeitlich** package; workflow code imports from `zeitlich/workflow`, activities and worker from `zeitlich`.

## Docs

- [Zeitlich on npm](https://www.npmjs.com/package/zeitlich)
- [Temporal docs](https://docs.temporal.io)

## License

MIT
