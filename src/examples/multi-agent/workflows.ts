/**
 * Workflow exports for the multi-agent example worker
 * All workflows must be exported here to be registered with the worker
 */

export { multiAgent as MultiAgent } from "./agent/workflow";
export { askNietzscheAgent as AskNietzscheAgent } from "./agent/subagents/nietzsche/workflow";
export { askAynRandAgent as AskAynRandAgent } from "./agent/subagents/ayn-rand/workflow";
