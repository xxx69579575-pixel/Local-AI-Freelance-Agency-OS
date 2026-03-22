/**
 * Generate an intake slug from a project name.
 * Rules (intake-module.md § 3.5):
 *  1. Lowercase
 *  2. Remove non-ASCII characters (including CJK)
 *  3. Replace special chars (except space/hyphen) with -
 *  4. Collapse consecutive - and trim
 *  5. If empty after above → "proj-{8 chars of UUID v4}"
 *  6. Collision: append incrementing number (my-project-2, -3, …)
 */
export declare function buildIntakeSlug(projectName: string): string;
/**
 * Resolve an intake slug, handling collisions by appending -2, -3, …
 */
export declare function resolveIntakeSlug(baseSlug: string, intakeDir: string): Promise<string>;
/**
 * Generate a dispatch task slug from alias + context.
 * Rules (dispatch-module.md § 3.1.1):
 *  1. alias stays as-is (already kebab)
 *  2. context → kebab: lowercase, remove non-ASCII, replace special chars with -, collapse
 *  3. If context-kebab non-empty → "{alias}-{context-kebab}"
 *  4. If context-kebab empty → just "{alias}"
 *  5. Collision → append timestamp "{slug}-{YYYYMMDDHHmm}"
 */
export declare function buildDispatchSlug(alias: string, context: string): string;
/**
 * Resolve a dispatch task slug, handling collisions by appending a timestamp.
 */
export declare function resolveDispatchSlug(baseSlug: string, tasksDir: string): Promise<string>;
//# sourceMappingURL=slug.d.ts.map