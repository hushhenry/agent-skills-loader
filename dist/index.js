"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSkillFromFile = loadSkillFromFile;
exports.loadSkills = loadSkills;
exports.formatSkillsForPrompt = formatSkillsForPrompt;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const ignore_1 = __importDefault(require("ignore"));
const utils_js_1 = require("./utils.js");
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".fdignore"];
function toPosixPath(p) {
    return p.split(node_path_1.sep).join("/");
}
function prefixIgnorePattern(line, prefix) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    if (trimmed.startsWith("#") && !trimmed.startsWith("\\#"))
        return null;
    let pattern = line;
    let negated = false;
    if (pattern.startsWith("!")) {
        negated = true;
        pattern = pattern.slice(1);
    }
    else if (pattern.startsWith("\\!")) {
        pattern = pattern.slice(1);
    }
    if (pattern.startsWith("/")) {
        pattern = pattern.slice(1);
    }
    const prefixed = prefix ? `${prefix}${pattern}` : pattern;
    return negated ? `!${prefixed}` : prefixed;
}
function addIgnoreRules(ig, dir, rootDir) {
    const relativeDir = (0, node_path_1.relative)(rootDir, dir);
    const prefix = relativeDir ? `${toPosixPath(relativeDir)}/` : "";
    for (const filename of IGNORE_FILE_NAMES) {
        const ignorePath = (0, node_path_1.join)(dir, filename);
        if (!(0, node_fs_1.existsSync)(ignorePath))
            continue;
        try {
            const content = (0, node_fs_1.readFileSync)(ignorePath, "utf-8");
            const patterns = content
                .split(/\r?\n/)
                .map((line) => prefixIgnorePattern(line, prefix))
                .filter((line) => Boolean(line));
            if (patterns.length > 0) {
                ig.add(patterns);
            }
        }
        catch { }
    }
}
function validateName(name, parentDirName) {
    const errors = [];
    if (name !== parentDirName) {
        errors.push(`name "${name}" does not match parent directory "${parentDirName}"`);
    }
    if (name.length > MAX_NAME_LENGTH) {
        errors.push(`name exceeds ${MAX_NAME_LENGTH} characters (${name.length})`);
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
        errors.push(`name contains invalid characters (must be lowercase a-z, 0-9, hyphens only)`);
    }
    if (name.startsWith("-") || name.endsWith("-")) {
        errors.push(`name must not start or end with a hyphen`);
    }
    if (name.includes("--")) {
        errors.push(`name must not contain consecutive hyphens`);
    }
    return errors;
}
function validateDescription(description) {
    const errors = [];
    if (!description || description.trim() === "") {
        errors.push("description is required");
    }
    else if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.push(`description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${description.length})`);
    }
    return errors;
}
function loadSkillFromFile(filePath, source) {
    const diagnostics = [];
    try {
        const rawContent = (0, node_fs_1.readFileSync)(filePath, "utf-8");
        const { frontmatter } = (0, utils_js_1.parseFrontmatter)(rawContent);
        const skillDir = (0, node_path_1.dirname)(filePath);
        const parentDirName = (0, node_path_1.basename)(skillDir);
        const descErrors = validateDescription(frontmatter.description);
        for (const error of descErrors) {
            diagnostics.push({ type: "warning", message: error, path: filePath });
        }
        const name = frontmatter.name || parentDirName;
        const nameErrors = validateName(name, parentDirName);
        for (const error of nameErrors) {
            diagnostics.push({ type: "warning", message: error, path: filePath });
        }
        if (!frontmatter.description || frontmatter.description.trim() === "") {
            return { skill: null, diagnostics };
        }
        return {
            skill: {
                name,
                description: frontmatter.description,
                filePath,
                baseDir: skillDir,
                source,
                disableModelInvocation: frontmatter["disable-model-invocation"] === true,
            },
            diagnostics,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "failed to parse skill file";
        diagnostics.push({ type: "warning", message, path: filePath });
        return { skill: null, diagnostics };
    }
}
function loadSkillsFromDirInternal(dir, source, includeRootFiles, ignoreMatcher, rootDir) {
    const skills = [];
    const diagnostics = [];
    if (!(0, node_fs_1.existsSync)(dir))
        return { skills, diagnostics };
    const root = rootDir ?? dir;
    const ig = ignoreMatcher ?? (0, ignore_1.default)();
    addIgnoreRules(ig, dir, root);
    try {
        const entries = (0, node_fs_1.readdirSync)(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith("."))
                continue;
            if (entry.name === "node_modules")
                continue;
            const fullPath = (0, node_path_1.join)(dir, entry.name);
            let isDirectory = entry.isDirectory();
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    const stats = (0, node_fs_1.statSync)(fullPath);
                    isDirectory = stats.isDirectory();
                    isFile = stats.isFile();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath((0, node_path_1.relative)(root, fullPath));
            const ignorePath = isDirectory ? `${relPath}/` : relPath;
            if (ig.ignores(ignorePath))
                continue;
            if (isDirectory) {
                const subResult = loadSkillsFromDirInternal(fullPath, source, false, ig, root);
                skills.push(...subResult.skills);
                diagnostics.push(...subResult.diagnostics);
                continue;
            }
            if (!isFile)
                continue;
            const isRootMd = includeRootFiles && entry.name.endsWith(".md");
            const isSkillMd = !includeRootFiles && entry.name === "SKILL.md";
            if (!isRootMd && !isSkillMd)
                continue;
            const result = loadSkillFromFile(fullPath, source);
            if (result.skill)
                skills.push(result.skill);
            diagnostics.push(...result.diagnostics);
        }
    }
    catch { }
    return { skills, diagnostics };
}
function loadSkills(options = {}) {
    const { cwd = process.cwd(), skillPaths = [] } = options;
    const skillMap = new Map();
    const realPathSet = new Set();
    const allDiagnostics = [];
    const collisionDiagnostics = [];
    function addSkills(result) {
        allDiagnostics.push(...result.diagnostics);
        for (const skill of result.skills) {
            let realPath;
            try {
                realPath = (0, node_fs_1.realpathSync)(skill.filePath);
            }
            catch {
                realPath = skill.filePath;
            }
            if (realPathSet.has(realPath))
                continue;
            const existing = skillMap.get(skill.name);
            if (existing) {
                collisionDiagnostics.push({
                    type: "collision",
                    message: `name "${skill.name}" collision`,
                    path: skill.filePath,
                    collision: {
                        resourceType: "skill",
                        name: skill.name,
                        winnerPath: existing.filePath,
                        loserPath: skill.filePath,
                    },
                });
            }
            else {
                skillMap.set(skill.name, skill);
                realPathSet.add(realPath);
            }
        }
    }
    for (const rawPath of skillPaths) {
        const resolvedPath = (0, node_path_1.isAbsolute)(rawPath) ? rawPath : (0, node_path_1.resolve)(cwd, rawPath);
        if (!(0, node_fs_1.existsSync)(resolvedPath)) {
            allDiagnostics.push({ type: "warning", message: "skill path does not exist", path: resolvedPath });
            continue;
        }
        try {
            const stats = (0, node_fs_1.statSync)(resolvedPath);
            if (stats.isDirectory()) {
                addSkills(loadSkillsFromDirInternal(resolvedPath, "path", true));
            }
            else if (stats.isFile() && resolvedPath.endsWith(".md")) {
                const result = loadSkillFromFile(resolvedPath, "path");
                if (result.skill) {
                    addSkills({ skills: [result.skill], diagnostics: result.diagnostics });
                }
                else {
                    allDiagnostics.push(...result.diagnostics);
                }
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "failed to read skill path";
            allDiagnostics.push({ type: "warning", message, path: resolvedPath });
        }
    }
    return {
        skills: Array.from(skillMap.values()),
        diagnostics: [...allDiagnostics, ...collisionDiagnostics],
    };
}
function formatSkillsForPrompt(skills) {
    const visibleSkills = skills.filter((s) => !s.disableModelInvocation);
    if (visibleSkills.length === 0)
        return "";
    const lines = [
        "\n\nThe following skills provide specialized instructions for specific tasks.",
        "Use the read tool to load a skill's file when the task matches its description.",
        "When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
        "",
        "<available_skills>",
    ];
    for (const skill of visibleSkills) {
        lines.push("  <skill>");
        lines.push(`    <name>${escapeXml(skill.name)}</name>`);
        lines.push(`    <description>${escapeXml(skill.description)}</description>`);
        lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
        lines.push("  </skill>");
    }
    lines.push("</available_skills>");
    return lines.join("\n");
}
function escapeXml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
