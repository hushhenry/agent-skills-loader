export interface ParsedFrontmatter<T extends Record<string, unknown>> {
    frontmatter: T;
    body: string;
}
export declare const parseFrontmatter: <T extends Record<string, unknown> = Record<string, unknown>>(content: string) => ParsedFrontmatter<T>;
