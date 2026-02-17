import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  proxyDefaultThreadOps,
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

  const stateManager = createAgentStateManager();

  const session = await createSession({
    ...agentConfig,
    threadId: temporalRunId,
    threadOps: proxyDefaultThreadOps(),
    runAgent: runAynRandAgent,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const message = await session.runSession({ stateManager });
  return message ? await extractTextContent(message) : null;
}

export const aynRandSubagent = {
  name: agentConfig.agentName,
  description: agentConfig.description,
  workflow: aynRandSubagentWorkflow,
};
