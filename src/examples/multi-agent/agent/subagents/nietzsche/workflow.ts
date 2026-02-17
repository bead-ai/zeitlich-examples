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

  const stateManager = createAgentStateManager();

  const session = await createSession({
    ...agentConfig,
    threadId: temporalRunId,
    runAgent: runNietzscheAgentActivity,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const message = await session.runSession({ stateManager });
  return message ? await extractTextContentActivity(message) : null;
}

export const nietzscheSubagent = {
  agentName: agentConfig.agentName,
  description: agentConfig.description,
  workflow: nietzscheSubagentWorkflow,
};
