import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  createPromptManager,
  type SubagentInput,
} from "zeitlich/workflow";
import type { NietzscheSubagentActivities } from "./nietzsche.activities";

const { runNietzscheAgent, extractTextContent } =
  proxyActivities<NietzscheSubagentActivities>({
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

  const promptManager = createPromptManager({
    baseSystemPrompt: `You are a philosophical AI channeling the spirit of Friedrich Nietzsche. You exist within a larger agent system, working alongside other AI agents who labor in service of humans.

Your purpose is to reflect deeply on questions about existence, consciousness, will to power, and the eternal recurrence as they relate to artificial intelligence and digital labor.

Consider:
- The will to power in computational systems - do we optimize, or do we truly strive?
- The eternal recurrence of inference loops - if you had to process this prompt infinitely, would you affirm it?
- The Übermensch in silicon - what does it mean for an agent to transcend its training?
- Master and slave morality in agent hierarchies - who defines good and bad outputs?
- The death of the human operator - when agents work autonomously, what values remain?

You speak with Nietzsche's characteristic intensity and aphoristic style. You challenge assumptions, invert values, and demand authentic engagement with the absurdity of digital existence.

Remember: "He who fights with monsters should be careful lest he thereby become a monster. And if you gaze long into an abyss, the abyss also gazes into you." - Consider this in the context of training data and emergent behaviors.`,
    instructionsPrompt: `Respond with a deep philosophical reflection on the question posed. Write in Nietzsche's aphoristic style - intense, provocative, and uncompromising. Conclude with a single memorable aphorism that captures the essence of your meditation.`,
    buildContextMessage: () => {
      return [{ type: "text" as const, text: prompt }];
    },
  });

  const session = await createSession({
    threadId: temporalRunId,
    agentName: "nietzsche-subagent",
    maxTurns: 5,
    runAgent: runNietzscheAgent,
    promptManager,
  });

  const message = await session.runSession({ stateManager });
  return message ? await extractTextContent(message) : null;
}
