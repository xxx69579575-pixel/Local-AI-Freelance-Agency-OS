const VALID_SEVERITIES = ["high", "medium", "low"];
/**
 * Validate and normalize risk items from AI output.
 * Ensures all required fields are present and severity is within allowed enum.
 */
export function normalizeRisks(risks) {
    return (risks ?? []).map((r, i) => normalizeRisk(r, i));
}
function normalizeRisk(r, index) {
    return {
        id: typeof r.id === "string" && r.id.length > 0 ? r.id : `R${index + 1}`,
        description: typeof r.description === "string" && r.description.length > 0
            ? r.description
            : "Unknown risk",
        severity: VALID_SEVERITIES.includes(r.severity)
            ? r.severity
            : "medium",
        mitigation: typeof r.mitigation === "string" && r.mitigation.length > 0
            ? r.mitigation
            : "To be determined",
    };
}
//# sourceMappingURL=risk-analyzer.js.map