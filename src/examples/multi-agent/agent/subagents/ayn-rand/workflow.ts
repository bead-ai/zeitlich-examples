import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  type SubagentInput,
} from "zeitlich/workflow";
import type { createAynRandSubagentActivities } from "./activities";
import { agentConfig } from "./config";

const { runAynRandAgent, extractTextContent } = proxyActivities<
  ReturnType<typeof createAynRandSubagentActivities>
>({
  startToCloseTimeout: "30m",
  retry: {
    maximumAttempts: 6,
    initialInterval: "5s",
    maximumInterval: "15m",
    backoffCoefficient: 4,
  },
  heartbeatTimeout: "5m",
});

export async function aynRandSubagentWorkflow({
  prompt,
}: SubagentInput): Promise<string | null> {
  const { runId: temporalRunId } = workflowInfo();

  const stateManager = createAgentStateManager({ agentConfig });

  const session = await createSession({
    ...agentConfig,
    threadId: temporalRunId,
    runAgent: runAynRandAgent,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const { finalMessage } = await session.runSession({ stateManager });
  return finalMessage ? await extractTextContent(finalMessage) : null;
}

export const aynRandSubagent = {
  agentName: agentConfig.agentName,
  description: agentConfig.description,
  workflow: aynRandSubagentWorkflow,
};
