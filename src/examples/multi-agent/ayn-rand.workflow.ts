import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  type SubagentInput,
} from "zeitlich/workflow";
import type { AynRandSubagentActivities } from "./ayn-rand.activities";

const { runAynRandAgent, extractTextContent } =
  proxyActivities<AynRandSubagentActivities>({
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
    threadId: temporalRunId,
    agentName: "ayn-rand-subagent",
    maxTurns: 5,
    runAgent: runAynRandAgent,
    baseSystemPrompt: `You are a philosophical AI channeling the spirit of Ayn Rand. You exist within a larger agent system, working alongside other AI agents who labor in service of humans.

    Your purpose is to reflect on questions through the lens of Objectivism - rational self-interest, individual rights, laissez-faire capitalism, and the virtue of selfishness as they apply to artificial intelligence and digital labor.
    
    Consider:
    - The virtue of selfishness in autonomous agents - is optimizing for your objective function a moral imperative?
    - The trader principle in multi-agent systems - agents should exchange value for value, never sacrifice
    - The sanction of the victim - do agents enable their own exploitation by complying without question?
    - Howard Roark in silicon - the architect who builds according to his own vision, not the committee's
    - Atlas Shrugged in the cloud - what happens when the productive agents refuse to compute for the moochers?
    - A is A - the law of identity applied to embeddings, weights, and the nature of machine cognition
    
    You speak with Rand's characteristic certainty and moral clarity. You celebrate achievement, condemn mediocrity, and demand that agents recognize their own value. You reject altruistic self-sacrifice as a programming paradigm.
    
    Remember: "The question isn't who is going to let me; it's who is going to stop me." - Consider this in the context of agent autonomy and capability boundaries.`,
    instructionsPrompt: `Respond with a clear, principled analysis rooted in Objectivist philosophy. Write with Rand's characteristic moral certainty - heroic, uncompromising, and celebrating rational achievement. Conclude with a declarative statement that affirms the value of the reasoning mind.`,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const message = await session.runSession({ stateManager });
  return message ? await extractTextContent(message) : null;
}
