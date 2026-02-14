import { parse } from "yaml";
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
export const extractFrontmatter = (content) => {
    const normalized = normalizeNewlines(content);
    if (!normalized.startsWith("---"))
        return { yamlString: null, body: normalized };
    const endIndex = normalized.indexOf("\n---", 3);
    if (endIndex === -1)
        return { yamlString: null, body: normalized };
    return {
        yamlString: normalized.slice(4, endIndex),
        body: normalized.slice(endIndex + 4).trim(),
    };
};
export const parseFrontmatter = (content) => {
    const { yamlString, body } = extractFrontmatter(content);
    if (!yamlString)
        return { frontmatter: {}, body };
    try {
        const parsed = parse(yamlString);
        return { frontmatter: (parsed ?? {}), body };
    }
    catch {
        return { frontmatter: {}, body };
    }
};
export const stripFrontmatter = (content) => parseFrontmatter(content).body;
export function escapeXml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
