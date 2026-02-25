import type { SkillsConfig } from "../../../lib/skills";

export const skillsConfig: SkillsConfig = {
  source: {
    owner: "apetta",
    repo: "agent-xlsx",
    ref: "main",
  },
  skills: [
    {
      name: "agent-xlsx",
      description:
        "Complete reference for the agent-xlsx CLI — commands, options, " +
        "backends, and usage patterns. Load before working with Excel files.",
    },
  ],
};
