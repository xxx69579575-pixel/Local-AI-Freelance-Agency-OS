// Core configuration and constants for Agency OS
export const CONFIG = {
    // AI model aliases
    models: {
        opus: "claude-opus-4-6",
        sonnet: "claude-sonnet-4-6",
        haiku: "claude-haiku-4-5-20251001",
    },
    // Directory paths (relative to project root)
    paths: {
        intake: "docs/intake",
        specs: "docs/specs",
        specReviews: "docs/specs/review",
        dispatch: ".dispatch/tasks",
        templates: ".dispatch/templates",
        src: "src",
        tests: "tests",
    },
    // IPC timing
    ipc: {
        questionTimeoutMs: 3 * 60 * 1000, // 3 minutes
    },
    // AI retry settings
    ai: {
        maxRetries: 2,
        totalAttempts: 3,
    },
};
// Valid dispatch aliases (mirrors dispatch-module.md § 3.6)
export const DISPATCH_ALIASES = [
    "intake",
    "write-spec",
    "review-spec",
    "update-spec",
    "implement",
    "add-feature",
    "fix-bug",
    "write-tests",
    "code-review",
    "qa-check",
    "security-audit",
    "deploy-vercel",
    "summarize",
];
//# sourceMappingURL=config.js.map