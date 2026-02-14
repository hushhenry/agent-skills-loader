export interface ParsedFrontmatter<T extends Record<string, unknown>> {
    frontmatter: T;
    body: string;
}
export declare const extractFrontmatter: (content: string) => {
    yamlString: string | null;
    body: string;
};
export declare const parseFrontmatter: <T extends Record<string, unknown> = Record<string, unknown>>(content: string) => ParsedFrontmatter<T>;
export declare const stripFrontmatter: (content: string) => string;
export declare function escapeXml(str: string): string;
