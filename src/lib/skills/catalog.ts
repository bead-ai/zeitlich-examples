import type { SkillsConfig } from "./types";

/**
 * Generates an XML catalog block for injection into the agent's system prompt.
 * Each skill entry costs ~100 tokens — the full SKILL.md is only loaded on demand.
 */
export function buildSkillCatalog(config: SkillsConfig): string {
  if (config.skills.length === 0) return "";

  const entries = config.skills
    .map(
      (skill) =>
        `  <skill name="${skill.name}">\n    ${skill.description}\n  </skill>`
    )
    .join("\n");

  return `<available_skills>\n${entries}\n</available_skills>\n\nTo activate a skill, run: \`load-skill <name>\``;
}
