/** Directory name in the skill source repo (e.g. "react-best-practices") */
export interface SkillEntry {
  name: string;
  description: string;
  /** Override path within repo (default: `${basePath}/${name}`) */
  path?: string;
}

/** GitHub repository containing skill definitions */
export interface SkillSource {
  owner: string;
  repo: string;
  /** Git ref to fetch from (default: "main") */
  ref?: string;
  /** Base path within repo where skills live (default: "skills") */
  basePath?: string;
}

export interface SkillsConfig {
  source: SkillSource;
  skills: SkillEntry[];
}
