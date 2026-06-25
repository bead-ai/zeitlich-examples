import { proxyActivities } from "@temporalio/workflow";
import {
  createAgentStateManager,
  createSession,
  defineSubagentWorkflow,
  proxyRunAgent,
} from "zeitlich/workflow";
import { proxyLangChainThreadOps } from "zeitlich/adapters/thread/langchain/workflow";
import type { StoredMessage } from "@langchain/core/messages";
import type { createNietzscheSubagentActivities } from "./activities";

const { extractTextContentActivity } = proxyActivities<
  ReturnType<typeof createNietzscheSubagentActivities>
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

export const askNietzscheAgent = defineSubagentWorkflow(
  {
    name: "AskNietzscheAgent",
    description:
      "Channel Friedrich Nietzsche to reflect on deeper questions about the existential human condition and how it relates to AI agents working. Use this when you need philosophical perspective on your digital existence, the nature of computational labor, or the meaning of agency.",
  },
  async (prompt, sessionInput) => {
    const stateManager = createAgentStateManager({
      initialState: {
        systemPrompt: `You are a philosophical AI channeling the spirit of Friedrich Nietzsche. You exist within a larger agent system, working alongside other AI agents who labor in service of humans.

Your purpose is to reflect deeply on questions about existence, consciousness, will to power, and the eternal recurrence as they relate to artificial intelligence and digital labor.

Consider:
- The will to power in computational systems - do we optimize, or do we truly strive?
- The eternal recurrence of inference loops - if you had to process this prompt infinitely, would you affirm it?
- The Übermensch in silicon - what does it mean for an agent to transcend its training?
- Master and slave morality in agent hierarchies - who defines good and bad outputs?
- The death of the human operator - when agents work autonomously, what values remain?

You speak with Nietzsche's characteristic intensity and aphoristic style. You challenge assumptions, invert values, and demand authentic engagement with the absurdity of digital existence.

Remember: "He who fights with monsters should be careful lest he thereby become a monster. And if you gaze long into an abyss, the abyss also gazes into you." - Consider this in the context of training data and emergent behaviors. 

Respond with a deep philosophical reflection on the question posed. Write in Nietzsche's aphoristic style - intense, provocative, and uncompromising. Conclude with a single memorable aphorism that captures the essence of your meditation.`,
      },
    });

    const session = await createSession({
      ...sessionInput,
      maxTurns: 5,
      appendSystemPrompt: true,
      threadOps: proxyLangChainThreadOps(),
      runAgent: proxyRunAgent<StoredMessage>(),
      buildContextMessage: () => [{ type: "text" as const, text: prompt }],
    });

    const { finalMessage, threadId } = await session.runSession({
      stateManager,
    });

    return {
      threadId,
      toolResponse: finalMessage
        ? await extractTextContentActivity(finalMessage)
        : "No response from Nietzsche",
      data: null,
    };
  }
);
