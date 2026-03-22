export interface IntakeInput {
    project_name: string;
    description: string;
    deadline?: string;
    budget?: string;
    tech_constraints?: string[];
}
export interface RiskItem {
    id: string;
    description: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
}
export interface FeatureItem {
    id: string;
    name: string;
    description: string;
    priority: "MVP" | "nice-to-have";
    phase: "1.1" | "1.2" | "1.3" | "1.4" | "2.1" | "2.2" | "2.3" | "2.4" | "2.5" | "3.1" | "3.2" | "4.1" | "4.2" | "5.x";
    complexity: "high" | "medium" | "low";
}
export interface NextAction {
    priority: "P0" | "P1" | "P2" | "P3";
    task: string;
    dispatch_alias: string;
    model: "opus" | "sonnet" | "haiku";
}
export interface IntakeOutput {
    project_name: string;
    version: string;
    created_at: string;
    background_summary: string;
    mvp_features: FeatureItem[];
    nice_to_have_features: FeatureItem[];
    risks: RiskItem[];
    implementation_order: string[];
    next_actions: NextAction[];
}
//# sourceMappingURL=intake.d.ts.map