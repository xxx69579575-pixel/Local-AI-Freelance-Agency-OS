const VALID_PHASES = [
    "1.1", "1.2", "1.3", "1.4",
    "2.1", "2.2", "2.3", "2.4", "2.5",
    "3.1", "3.2",
    "4.1", "4.2",
    "5.x",
];
const VALID_COMPLEXITIES = ["high", "medium", "low"];
const VALID_PRIORITIES = ["MVP", "nice-to-have"];
/**
 * Validate and normalize MVP and Nice-to-Have feature arrays from AI output.
 * Ensures all required fields are present and values are within allowed enums.
 */
export function normalizeFeatures(mvpFeatures, niceToHaveFeatures) {
    const mvp = (mvpFeatures ?? []).map((f, i) => normalizeFeature(f, i, "MVP", "M"));
    const niceToHave = (niceToHaveFeatures ?? []).map((f, i) => normalizeFeature(f, i, "nice-to-have", "N"));
    return { mvp, niceToHave };
}
function normalizeFeature(f, index, defaultPriority, idPrefix) {
    return {
        id: typeof f.id === "string" && f.id.length > 0 ? f.id : `${idPrefix}${index + 1}`,
        name: typeof f.name === "string" && f.name.length > 0 ? f.name : "Unnamed Feature",
        description: typeof f.description === "string" ? f.description : "",
        priority: VALID_PRIORITIES.includes(f.priority)
            ? f.priority
            : defaultPriority,
        phase: VALID_PHASES.includes(f.phase)
            ? f.phase
            : "1.1",
        complexity: VALID_COMPLEXITIES.includes(f.complexity)
            ? f.complexity
            : "medium",
    };
}
//# sourceMappingURL=classifier.js.map