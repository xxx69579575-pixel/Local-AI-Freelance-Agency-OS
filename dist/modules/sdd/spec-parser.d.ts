export interface ACItem {
    id: string;
    description: string;
    test_method: string;
}
/**
 * Parse the version string from a spec document.
 * Looks for: > **文件版本**：v1.1
 */
export declare function parseVersion(content: string): string;
/**
 * Parse which required section numbers (1–5) are present.
 * Supports Arabic numeral format: ## 1. or ## 1、
 * (§ 3.3 RV-024: only Arabic numerals for docs/specs/*.md)
 */
export declare function parseRequiredSections(content: string): string[];
/**
 * Parse all AC items from the ## 5. 驗收標準 table.
 */
export declare function parseAcceptanceCriteria(content: string): ACItem[];
/**
 * Summarize an implementation directory's .ts files for drift-check prompts.
 * Returns a text summary of function/class signatures found.
 */
export declare function summarizeImplementation(files: Map<string, string>): string;
//# sourceMappingURL=spec-parser.d.ts.map