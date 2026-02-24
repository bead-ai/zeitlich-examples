import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  type SubagentInput,
} from "zeitlich/workflow";
import type { createNietzscheSubagentActivities } from "./activities";
import { agentConfig } from "./config";

const { runNietzscheAgentActivity, extractTextContentActivity } =
  proxyActivities<ReturnType<typeof createNietzscheSubagentActivities>>({
    startToCloseTimeout: "30m",
    retry: {
      maximumAttempts: 6,
      initialInterval: "5s",
      maximumInterval: "15m",
      backoffCoefficient: 4,
    },
    heartbeatTimeout: "5m",
  });

export async function nietzscheSubagentWorkflow({
  prompt,
}: SubagentInput): Promise<string | null> {
  const { runId: temporalRunId } = workflowInfo();

  const stateManager = createAgentStateManager({ agentConfig });

  const session = await createSession({
    ...agentConfig,
    threadId: temporalRunId,
    runAgent: runNietzscheAgentActivity,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const { finalMessage } = await session.runSession({ stateManager });
  return finalMessage ? await extractTextContentActivity(finalMessage) : null;
}

export const nietzscheSubagent = {
  agentName: agentConfig.agentName,
  description: agentConfig.description,
  workflow: nietzscheSubagentWorkflow,
};
