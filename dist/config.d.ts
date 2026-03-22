export declare const CONFIG: {
    readonly models: {
        readonly opus: "claude-opus-4-6";
        readonly sonnet: "claude-sonnet-4-6";
        readonly haiku: "claude-haiku-4-5-20251001";
    };
    readonly paths: {
        readonly intake: "docs/intake";
        readonly specs: "docs/specs";
        readonly specReviews: "docs/specs/review";
        readonly dispatch: ".dispatch/tasks";
        readonly templates: ".dispatch/templates";
        readonly src: "src";
        readonly tests: "tests";
    };
    readonly ipc: {
        readonly questionTimeoutMs: number;
    };
    readonly ai: {
        readonly maxRetries: 2;
        readonly totalAttempts: 3;
    };
};
export declare const DISPATCH_ALIASES: readonly ["intake", "write-spec", "review-spec", "update-spec", "implement", "add-feature", "fix-bug", "write-tests", "code-review", "qa-check", "security-audit", "deploy-vercel", "summarize"];
export type DispatchAlias = (typeof DISPATCH_ALIASES)[number];
//# sourceMappingURL=config.d.ts.map