/**
 * Workflow exports for the multi-agent example worker
 * All workflows must be exported here to be registered with the worker
 */

export { multiAgentWorkflow } from "./agent/workflow";
export { nietzscheSubagentWorkflow } from "./agent/subagents/nietzsche/workflow";
export { aynRandSubagentWorkflow } from "./agent/subagents/ayn-rand/workflow";
