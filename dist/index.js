import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import ignore from "ignore";
import { parseFrontmatter, escapeXml } from "./utils.js";
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".fdignore"];
const ignoreFactory = ignore.default || ignore;
function toPosixPath(p) {
    return p.split(sep).join("/");
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
    const relativeDir = relative(rootDir, dir);
    const prefix = relativeDir ? `${toPosixPath(relativeDir)}/` : "";
    for (const filename of IGNORE_FILE_NAMES) {
        const ignorePath = join(dir, filename);
        if (!existsSync(ignorePath))
            continue;
        try {
            const content = readFileSync(ignorePath, "utf-8");
            const patterns = content.split(/\r?\n/).map((line) => prefixIgnorePattern(line, prefix)).filter((line) => Boolean(line));
            if (patterns.length > 0)
                ig.add(patterns);
        }
        catch { }
    }
}
export function validateName(name, parentDirName) {
    const errors = [];
    if (name !== parentDirName)
        errors.push(`name "${name}" does not match parent directory "${parentDirName}"`);
    if (name.length > MAX_NAME_LENGTH)
        errors.push(`name exceeds ${MAX_NAME_LENGTH} characters`);
    if (!/^[a-z0-9-]+$/.test(name))
        errors.push(`invalid characters in name`);
    return errors;
}
export function validateDescription(description) {
    const errors = [];
    if (!description || description.trim() === "")
        errors.push("description is required");
    else if (description.length > MAX_DESCRIPTION_LENGTH)
        errors.push(`description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
    return errors;
}
export function loadSkillFromFile(filePath, source) {
    const diagnostics = [];
    try {
        const rawContent = readFileSync(filePath, "utf-8");
        const { frontmatter } = parseFrontmatter(rawContent);
        const skillDir = dirname(filePath);
        const parentDirName = basename(skillDir);
        const name = frontmatter.name || parentDirName;
        validateDescription(frontmatter.description).forEach(m => diagnostics.push({ type: "warning", message: m, path: filePath }));
        validateName(name, parentDirName).forEach(m => diagnostics.push({ type: "warning", message: m, path: filePath }));
        if (!frontmatter.description)
            return { skill: null, diagnostics };
        return {
            skill: { name, description: frontmatter.description, filePath, baseDir: skillDir, source, disableModelInvocation: frontmatter["disable-model-invocation"] === true },
            diagnostics
        };
    }
    catch (e) {
        diagnostics.push({ type: "warning", message: e.message, path: filePath });
        return { skill: null, diagnostics };
    }
}
export function loadSkillsFromDir(dir, source, includeRootFiles = true, ignoreMatcher, rootDir) {
    const skills = [];
    const diagnostics = [];
    if (!existsSync(dir))
        return { skills, diagnostics };
    const root = rootDir ?? dir;
    const ig = ignoreMatcher ?? ignoreFactory();
    addIgnoreRules(ig, dir, root);
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith(".") || entry.name === "node_modules")
                continue;
            const fullPath = join(dir, entry.name);
            let isDir = entry.isDirectory();
            if (entry.isSymbolicLink()) {
                try {
                    isDir = statSync(fullPath).isDirectory();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath(relative(root, fullPath));
            if (ig.ignores(isDir ? `${relPath}/` : relPath))
                continue;
            if (isDir) {
                const sub = loadSkillsFromDir(fullPath, source, false, ig, root);
                skills.push(...sub.skills);
                diagnostics.push(...sub.diagnostics);
            }
            else {
                const isRootMd = includeRootFiles && entry.name.endsWith(".md");
                const isSkillMd = !includeRootFiles && entry.name === "SKILL.md";
                if (isRootMd || isSkillMd) {
                    const res = loadSkillFromFile(fullPath, source);
                    if (res.skill)
                        skills.push(res.skill);
                    diagnostics.push(...res.diagnostics);
                }
            }
        }
    }
    catch { }
    return { skills, diagnostics };
}
export function loadSkills(options = {}) {
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
                realPath = realpathSync(skill.filePath);
            }
            catch {
                realPath = skill.filePath;
            }
            if (realPathSet.has(realPath))
                continue;
            const existing = skillMap.get(skill.name);
            if (existing) {
                collisionDiagnostics.push({ type: "collision", message: `name "${skill.name}" collision`, path: skill.filePath, collision: { resourceType: "skill", name: skill.name, winnerPath: existing.filePath, loserPath: skill.filePath } });
            }
            else {
                skillMap.set(skill.name, skill);
                realPathSet.add(realPath);
            }
        }
    }
    for (const rawPath of skillPaths) {
        const resolvedPath = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath);
        if (!existsSync(resolvedPath)) {
            allDiagnostics.push({ type: "warning", message: "path not found", path: resolvedPath });
            continue;
        }
        const stats = statSync(resolvedPath);
        if (stats.isDirectory())
            addSkills(loadSkillsFromDir(resolvedPath, "path", true));
        else if (stats.isFile() && resolvedPath.endsWith(".md")) {
            const res = loadSkillFromFile(resolvedPath, "path");
            if (res.skill)
                addSkills({ skills: [res.skill], diagnostics: res.diagnostics });
            else
                allDiagnostics.push(...res.diagnostics);
        }
    }
    return { skills: Array.from(skillMap.values()), diagnostics: [...allDiagnostics, ...collisionDiagnostics] };
}
export function formatSkillsForPrompt(skills) {
    const visible = skills.filter((s) => !s.disableModelInvocation);
    if (visible.length === 0)
        return "";
    const lines = [
        "\n\nThe following skills provide specialized instructions for specific tasks.",
        "Use the read tool to load a skill's file when the task matches its description.",
        "When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
        "",
        "<available_skills>",
    ];
    for (const skill of visible) {
        lines.push("  <skill>");
        lines.push(`    <name>${escapeXml(skill.name)}</name>`);
        lines.push(`    <description>${escapeXml(skill.description)}</description>`);
        lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
        lines.push("  </skill>");
    }
    lines.push("</available_skills>");
    return lines.join("\n");
}
