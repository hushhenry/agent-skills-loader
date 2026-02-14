import type { Skill, LoadSkillsResult, ResourceDiagnostic } from "./types.js";
declare const ignoreFactory: any;
type IgnoreMatcher = ReturnType<typeof ignoreFactory>;
export declare function validateName(name: string, parentDirName: string): string[];
export declare function validateDescription(description: string | undefined): string[];
export declare function loadSkillFromFile(filePath: string, source: string): {
    skill: Skill | null;
    diagnostics: ResourceDiagnostic[];
};
export declare function loadSkillsFromDir(dir: string, source: string, includeRootFiles?: boolean, ignoreMatcher?: IgnoreMatcher, rootDir?: string): LoadSkillsResult;
export interface LoadSkillsOptions {
    cwd?: string;
    skillPaths?: string[];
}
export declare function loadSkills(options?: LoadSkillsOptions): LoadSkillsResult;
export declare function formatSkillsForPrompt(skills: Skill[]): string;
export {};
