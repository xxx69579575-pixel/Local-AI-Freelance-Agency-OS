export interface DriftItem {
    ac_id: string;
    description: string;
    severity: "high" | "medium" | "low";
}
export interface DriftResult {
    drifts: DriftItem[];
    total_acs: number;
    passed: number;
    failed: number;
    analysis_method: "ai";
    coverage_note: string;
}
/**
 * Run drift check: compare spec AC list against implementation files.
 *
 * @param specSlug  e.g. "intake-module"
 * @param implPath  e.g. "src/modules/intake/"
 */
export declare function runDriftCheck(specSlug: string, implPath: string): Promise<DriftResult>;
//# sourceMappingURL=drift-checker.d.ts.map