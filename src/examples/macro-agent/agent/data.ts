import { InMemoryFs } from "just-bash";
import { mountSkills } from "../../../lib/skills";
import { skillsConfig } from "./skills-config";

// Minimal InMemoryFs solely for hosting skills — actual data files live in the sandbox
export const inMemoryFileSystem = new InMemoryFs({});

// Mount skills as lazy files — fetched from GitHub on first read, cached thereafter
mountSkills(inMemoryFileSystem, skillsConfig);
