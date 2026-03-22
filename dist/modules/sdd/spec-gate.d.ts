export interface SpecGateCheck {
    name: string;
    passed: boolean;
    message: string;
}
export interface SpecGateResult {
    passed: boolean;
    spec_path: string;
    version: string;
    checks: SpecGateCheck[];
}
/**
 * Run the Spec Gate for a given spec slug.
 *
 * @param specSlug       e.g. "intake-module"
 * @param requireReviewed  Whether to check review file / open issues
 * @param callerAlias    If provided and is an impl alias, forces requireReviewed=true
 */
export declare function runSpecGate(specSlug: string, requireReviewed?: boolean, callerAlias?: string): Promise<SpecGateResult>;
//# sourceMappingURL=spec-gate.d.ts.map