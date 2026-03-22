import type { FeatureItem } from "../../types/intake.js";
/**
 * Validate and normalize MVP and Nice-to-Have feature arrays from AI output.
 * Ensures all required fields are present and values are within allowed enums.
 */
export declare function normalizeFeatures(mvpFeatures: FeatureItem[], niceToHaveFeatures: FeatureItem[]): {
    mvp: FeatureItem[];
    niceToHave: FeatureItem[];
};
//# sourceMappingURL=classifier.d.ts.map