import type { Skill, LoadSkillsResult, ResourceDiagnostic } from "./types.js";
export declare function loadSkillFromFile(filePath: string, source: string): {
    skill: Skill | null;
    diagnostics: ResourceDiagnostic[];
};
export interface LoadSkillsOptions {
    cwd?: string;
    skillPaths?: string[];
}
export declare function loadSkills(options?: LoadSkillsOptions): LoadSkillsResult;
export declare function formatSkillsForPrompt(skills: Skill[]): string;
