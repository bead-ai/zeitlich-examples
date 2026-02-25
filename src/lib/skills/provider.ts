import { type InMemoryFs, defineCommand, type CustomCommand } from "just-bash";
import type { SkillsConfig, SkillEntry, SkillSource } from "./types";

const LOG_PREFIX = "[skills]";

/** Resolves the repo-relative path for a skill directory */
function resolveSkillRepoPath(source: SkillSource, skill: SkillEntry): string {
  const basePath = source.basePath ?? "skills";
  return skill.path ?? `${basePath}/${skill.name}`;
}

/** Builds a raw.githubusercontent.com URL for a file within a skill */
function buildRawUrl(
  source: SkillSource,
  repoPath: string,
  filePath: string
): string {
  const ref = source.ref ?? "main";
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${ref}/${repoPath}/${filePath}`;
}

/**
 * Creates a lazy file provider that fetches content from a raw GitHub URL.
 * Returns an error string on failure instead of throwing — the agent sees the error.
 */
function createLazyFetcher(url: string, label: string): () => Promise<string> {
  return async () => {
    console.log(`${LOG_PREFIX} Fetching ${label}: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`${LOG_PREFIX} HTTP ${response.status} fetching ${label}`);
        return `[Error] Failed to fetch "${label}" (HTTP ${response.status})\nURL: ${url}`;
      }
      const text = await response.text();
      console.log(`${LOG_PREFIX} Loaded ${label} (${text.length} chars)`);
      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIX} Error fetching ${label}: ${message}`);
      return `[Error] Failed to fetch "${label}": ${message}\nURL: ${url}`;
    }
  };
}

// GitHub Contents API response item
interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
}

/**
 * Discovers all files in a skill's directory via the GitHub Contents API.
 * Recursively traverses subdirectories (e.g. rules/).
 * Returns paths relative to the skill's root directory.
 */
async function discoverSkillFiles(
  source: SkillSource,
  repoPath: string,
  relativePath: string = ""
): Promise<string[]> {
  const ref = source.ref ?? "main";
  const apiPath = relativePath ? `${repoPath}/${relativePath}` : repoPath;
  const url = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${apiPath}?ref=${ref}`;

  console.log(`${LOG_PREFIX} Discovering files at: ${apiPath}`);

  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!response.ok) {
    console.warn(
      `${LOG_PREFIX} Discovery failed for ${apiPath} (HTTP ${response.status})`
    );
    return [];
  }

  const items = (await response.json()) as GitHubContentItem[];
  const files: string[] = [];

  for (const item of items) {
    const itemRelative = relativePath
      ? `${relativePath}/${item.name}`
      : item.name;

    if (item.type === "file") {
      files.push(itemRelative);
    } else if (item.type === "dir") {
      // Recurse into subdirectories (e.g. rules/)
      const subFiles = await discoverSkillFiles(source, repoPath, itemRelative);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Mounts skills as lazy files in the InMemoryFs.
 * Only SKILL.md is mounted at init time — the full directory tree is
 * discovered and mounted on first `load-skill` activation.
 */
export function mountSkills(fs: InMemoryFs, config: SkillsConfig): void {
  const { source, skills } = config;

  for (const skill of skills) {
    const repoPath = resolveSkillRepoPath(source, skill);
    const url = buildRawUrl(source, repoPath, "SKILL.md");

    fs.writeFileLazy(
      `skills/${skill.name}/SKILL.md`,
      createLazyFetcher(url, `${skill.name}/SKILL.md`)
    );
    console.log(`${LOG_PREFIX} Mounted lazy: skills/${skill.name}/SKILL.md`);
  }

  // Static README listing all available skills
  const readmeLines = [
    "# Available Skills",
    "",
    "Use `load-skill <name>` to activate a skill.",
    "",
    ...skills.map((s) => `- **${s.name}** — ${s.description}`),
    "",
  ];
  fs.writeFileSync("skills/README.md", readmeLines.join("\n"));
  console.log(`${LOG_PREFIX} Mounted ${skills.length} skill(s)`);
}

/**
 * Creates a `load-skill` custom command for the bash environment.
 *
 * On first activation of each skill, discovers the full directory tree
 * via the GitHub Contents API and mounts all files as lazy entries.
 * This ensures the agent can `cat` individual rule files, AGENTS.md, etc.
 *
 * @param config - Skill configuration (source + entries)
 * @param fs - The shared InMemoryFs instance for dynamic file mounting
 */
export function createLoadSkillCommand(
  config: SkillsConfig,
  fs: InMemoryFs
): CustomCommand {
  const { source, skills } = config;
  const skillsByName = new Map(skills.map((s) => [s.name, s]));

  // Track which skills have had their full directory discovered
  const discoveredSkills = new Set<string>();

  return defineCommand("load-skill", async (args, ctx) => {
    const name = args[0];

    // No arguments — list available skills
    if (!name) {
      const listing = skills
        .map((s) => `  ${s.name}\n    ${s.description}`)
        .join("\n\n");

      return {
        stdout: `Available skills:\n\n${listing}\n\nUsage: load-skill <name>\n`,
        stderr: "",
        exitCode: 0,
      };
    }

    const skill = skillsByName.get(name);

    // Unknown skill name
    if (!skill) {
      const available = skills.map((s) => s.name).join(", ");
      return {
        stdout: "",
        stderr: `Unknown skill: "${name}"\nAvailable skills: ${available}\n`,
        exitCode: 1,
      };
    }

    // Discover and mount all files for this skill on first activation
    if (!discoveredSkills.has(name)) {
      console.log(
        `${LOG_PREFIX} First activation of "${name}" — discovering reference files...`
      );
      try {
        const repoPath = resolveSkillRepoPath(source, skill);
        const files = await discoverSkillFiles(source, repoPath);

        let mountedCount = 0;
        for (const filePath of files) {
          // SKILL.md is already mounted by mountSkills — skip to avoid overwriting
          if (filePath === "SKILL.md") continue;

          const mountPath = `skills/${name}/${filePath}`;
          const rawUrl = buildRawUrl(source, repoPath, filePath);
          fs.writeFileLazy(
            mountPath,
            createLazyFetcher(rawUrl, `${name}/${filePath}`)
          );
          mountedCount++;
        }

        discoveredSkills.add(name);
        console.log(
          `${LOG_PREFIX} Discovered and mounted ${mountedCount} reference file(s) for "${name}"`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `${LOG_PREFIX} Discovery failed for "${name}": ${message} (SKILL.md still available)`
        );
        // Don't block — SKILL.md is still mounted and loadable
      }
    }

    // Build a file listing hint so the agent knows what's available
    const refHint = discoveredSkills.has(name)
      ? `\n\n---\nReference files available at /skills/${name}/ — use absolute paths (e.g. cat /skills/${name}/rules/<file>.md)`
      : "";

    // Read and return the main SKILL.md
    try {
      const content = await ctx.fs.readFile(`skills/${name}/SKILL.md`);
      return { stdout: content + refHint, stderr: "", exitCode: 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        stdout: "",
        stderr: `Failed to load skill "${name}": ${message}\n`,
        exitCode: 1,
      };
    }
  });
}
