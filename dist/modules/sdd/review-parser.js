// SDD module — review document parser (sdd-workflow.md § 3.5)
/**
 * Parse the reviewed version from a review document.
 * Looks for: > **審查版本**：v1.0
 */
export function parseReviewedVersion(content) {
    const match = /\*\*審查版本\*\*[：:]\s*(v\d+\.\d+)/.exec(content);
    return match?.[1] ?? "v1.0";
}
/**
 * Parse the review date from a review document.
 */
export function parseReviewedAt(content) {
    const match = /\*\*審查日期\*\*[：:]\s*(\d{4}-\d{2}-\d{2})/.exec(content);
    return match?.[1] ?? "";
}
/**
 * Parse all review issues (OPEN and RESOLVED) from the issue table.
 * Table format: | RV-ID | 章節 | 問題類型 | 問題描述 | 嚴重度 | 狀態 |
 */
export function parseIssues(content) {
    const issues = [];
    const lines = content.split("\n");
    for (const line of lines) {
        // Match table row with at least 6 pipe-separated cells
        const match = /^\|\s*(RV-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(OPEN|RESOLVED[^|]*?)\s*\|/.exec(line);
        if (!match)
            continue;
        const statusRaw = match[6].trim();
        const isResolved = statusRaw.startsWith("RESOLVED");
        const resolvedIn = isResolved
            ? (/\(([^)]+)\)/.exec(statusRaw)?.[1])
            : undefined;
        issues.push({
            id: match[1].trim(),
            section: match[2].trim(),
            type: match[3].trim(),
            description: match[4].trim(),
            severity: match[5].trim(),
            status: isResolved ? "RESOLVED" : "OPEN",
            ...(resolvedIn ? { resolved_in: resolvedIn } : {}),
        });
    }
    return issues;
}
/**
 * Return only OPEN issues from a review document.
 */
export function getOpenIssues(content) {
    return parseIssues(content).filter((i) => i.status === "OPEN");
}
//# sourceMappingURL=review-parser.js.map