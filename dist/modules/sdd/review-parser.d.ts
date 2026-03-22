export interface ReviewIssue {
    id: string;
    section: string;
    type: string;
    description: string;
    severity: string;
    status: "OPEN" | "RESOLVED";
    resolved_in?: string;
}
export interface ReviewDocument {
    spec_slug: string;
    reviewed_version: string;
    reviewed_at: string;
    issues: ReviewIssue[];
}
/**
 * Parse the reviewed version from a review document.
 * Looks for: > **審查版本**：v1.0
 */
export declare function parseReviewedVersion(content: string): string;
/**
 * Parse the review date from a review document.
 */
export declare function parseReviewedAt(content: string): string;
/**
 * Parse all review issues (OPEN and RESOLVED) from the issue table.
 * Table format: | RV-ID | 章節 | 問題類型 | 問題描述 | 嚴重度 | 狀態 |
 */
export declare function parseIssues(content: string): ReviewIssue[];
/**
 * Return only OPEN issues from a review document.
 */
export declare function getOpenIssues(content: string): ReviewIssue[];
//# sourceMappingURL=review-parser.d.ts.map