# The Multi-Agent Macroeconomist

**Zeitlich + agent-xlsx + @anthropic-ai/sandbox-runtime**

A multi-agent data pipeline that downloads the World Bank WDI dataset (~76MB, 401K rows), extracts economic indicators via specialized agents, and builds a formatted Excel dashboard — with every `agent-xlsx` CLI call running inside Anthropic's OS-level sandbox (the same kernel isolation that powers Claude Code).

## Quick Start

```bash
# Prerequisites
uv tool install agent-xlsx          # agent-xlsx CLI on host PATH
temporal server start-dev            # Terminal 1

# Run
npm run worker:macro-agent           # Terminal 2
npm run start:macro-agent            # Terminal 3
```

Requires Redis on `localhost:6379` and Temporal on `localhost:7233`.

## Architecture

```
User Prompt
    |
    v
 Orchestrator (Herr Zeitlich)           task queue: "macro-agent"
    |
    |-- 1. fetchAndPrepareDataset()     Downloads WDI ZIP, extracts .xlsx
    |                                   Runs OUTSIDE sandbox (needs network)
    |
    |-- 2. DataMiner subagent           probe → search → read → write data.xlsx
    |      [sandboxed]                  Series-sheet-first strategy for indicator lookup
    |
    |-- 3. Modeler subagent             read data.xlsx → write + format Dashboard.xlsx
    |      [sandboxed]                  Live formulas, formatted output
    |
    |-- 4. QA check                     read Dashboard.xlsx to verify output
    |
    v
 Dashboard.xlsx (base64 in result + on disk at ./sandbox/)
```

### Tool Design

All three agents share a single `AgentXlsx` tool — a generic passthrough that executes any `agent-xlsx` CLI command inside the sandbox. The agent constructs the full command string based on its system prompt and the agent-xlsx skill docs; the activity just prefixes `agent-xlsx` and executes it.

```
Agent → AgentXlsx tool (command string) → agentXlsxActivity → execSandboxed("agent-xlsx <command>")
```

This replaces the alternative approach of per-subcommand typed tools (ProbeExcel, SearchExcel, etc.) with individual Zod schemas and activity functions. The generic approach is simpler, less brittle (no schema updates when agent-xlsx adds features), and lets agents leverage the full CLI surface.

## File Structure

```
src/examples/macro-agent/
├── workflows.ts                  Re-exports all 3 workflows (Temporal requirement)
├── worker.ts                     Worker + sandbox init/teardown
├── start.ts                      Client trigger
├── sandbox.ts                    SandboxManager config + execSandboxed helper
├── tools.ts                      Single AgentXlsx tool definition
└── agent/
    ├── workflow.ts               Orchestrator (Herr Zeitlich)
    ├── activities.ts             Single activity factory (shared by all 3 agents)
    ├── config.ts                 Orchestrator agent config
    ├── skills-config.ts          agent-xlsx skill source reference (GitHub)
    ├── data.ts                   InMemoryFs for skill file hosting
    └── subagents/
        ├── miner/
        │   ├── workflow.ts       Data extraction specialist
        │   └── config.ts         Series-sheet strategy, scoped search, multi-range reads
        └── modeler/
            ├── workflow.ts       Dashboard builder
            └── config.ts         Auto-create, live formulas, institutional design spec
```

## Sandbox

`sandbox.ts` wraps every `agent-xlsx` call with `@anthropic-ai/sandbox-runtime`:

- **Network:** Fully airgapped (`allowedDomains: []`)
- **Filesystem writes:** Kernel-restricted to `./sandbox/` and `/tmp/agent-xlsx`
- **Filesystem reads:** Sensitive paths denied (`~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config`, `~/.netrc`)
- **cwd:** Locked to `./sandbox/` — all agent file paths resolve within the sandbox
- **macOS:** Apple Seatbelt (`sandbox-exec`), **Linux:** bubblewrap (`bwrap`)

Zero cold start — unlike Docker (~500ms+ per container), the sandbox is just a command prefix with no container overhead. This matters when agents make 10-20+ CLI calls per session.

## Skills Provider

Agents need to know the full `agent-xlsx` CLI surface to construct commands for the generic tool. Rather than bloating system prompts with the entire reference (~thousands of tokens), this example uses a two-phase lazy loading pattern built on `src/lib/skills/`:

1. **System prompt — cheap catalog.** `buildSkillCatalog()` injects a small `<available_skills>` XML block (~100 tokens) into each agent's system prompt, listing available skills and how to activate them.

2. **On-demand activation — `load-skill`.** When an agent runs `load-skill agent-xlsx` via the Bash tool, the `createLoadSkillCommand` handler discovers the full skill directory tree via the GitHub Contents API (`apetta/agent-xlsx` repo), mounts every file as a lazy entry in `InMemoryFs`, and returns the main `SKILL.md` plus a hint about available reference file paths.

3. **Lazy reference loading.** Individual files (e.g. `/skills/agent-xlsx/references/commands.md`) are only fetched from raw.githubusercontent.com when the agent `cat`s them — no upfront cost for files the agent never reads.

```
System prompt:  <available_skills><skill name="agent-xlsx">...</skill></available_skills>
                                                    ↓
Agent runs:     load-skill agent-xlsx               → discovers tree, returns SKILL.md
Agent runs:     cat /skills/agent-xlsx/references/commands.md  → lazy fetch on first read
```

The wiring: `skills-config.ts` declares the source repo, `data.ts` creates the `InMemoryFs` and calls `mountSkills()` at import time, and `activities.ts` passes both the filesystem and the `load-skill` command into `createBashHandler()` — shared by all three agents.

## Key Design Decisions

**Single generic tool.** All agents use one `AgentXlsx` tool that passes the command string directly to the CLI. This avoids schema drift when agent-xlsx adds features and lets agents leverage the full CLI surface via their system prompts and loaded skill docs.

**Strategy-driven prompts.** Agent prompts teach _strategy_ rather than prescribing exact commands. The Miner searches the Series sheet first (~1,500 rows) instead of brute-forcing the 401K-row Data sheet. The Modeler uses `recalc` after writing formulas and produces live Excel formulas instead of hardcoded values. The Orchestrator passes `column_map` to the Miner and delegates data handoff via `data.xlsx`.

**Dynamic dataset filename.** `fetchAndPrepareDataset` extracts the first `.xlsx` found in the ZIP and returns the actual filename (e.g. `WDIEXCEL.xlsx`). The orchestrator interpolates this into its system prompt so all agents reference the correct file.

**Sandbox as contract.** `./sandbox/` is the shared boundary between agents. The fetch activity places the dataset there, the Miner reads from it and writes `data.xlsx`, the Modeler reads `data.xlsx` and writes `Dashboard.xlsx`, and the Orchestrator QA-checks the result. Enforced by the OS kernel.

**Durable by default.** Every activity call is a Temporal recovery point. If the worker crashes between the Miner extracting data and the Modeler building the dashboard, the workflow resumes from the last checkpoint.

## Dependencies

| Package | Purpose |
|---|---|
| `zeitlich` | Durable AI agent framework (Temporal + LangChain) |
| `@anthropic-ai/sandbox-runtime` | OS-level process sandboxing |
| `@langchain/anthropic` | Claude model integration |
| `@temporalio/*` | Workflow engine |
| `yauzl` | ZIP extraction for WDI dataset |
| `zod` | Tool schema definition |
| `ioredis` | Redis for state persistence |

**Host requirement:** `agent-xlsx` on PATH — install via `uv tool install agent-xlsx`. Note: `uvx agent-xlsx` is incompatible with the Seatbelt sandbox on macOS (`uv`'s Rust runtime panics when `SCDynamicStore` is blocked). The pre-installed binary avoids this.

**Platform dependencies:**

| Platform | Sandbox Runtime | Install |
|---|---|---|
| macOS | `sandbox-exec` (built-in) | Nothing — ships with macOS |
| Linux | `bubblewrap` + `socat` | `apt install bubblewrap socat` |
