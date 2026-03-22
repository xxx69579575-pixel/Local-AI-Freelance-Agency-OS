/**
 * Parse a version string into [major, minor] integers.
 * Returns [1, 0] for unrecognised or missing versions.
 */
export declare function parseVersionParts(version: string): [number, number];
/**
 * Compare two version strings.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export declare function compareVersion(a: string, b: string): number;
/**
 * Increment the minor version: v1.0 → v1.1, v1.2 → v1.3
 */
export declare function incrementMinorVersion(version: string): string;
/**
 * Increment the major version: v1.x → v2.0
 */
export declare function incrementMajorVersion(version: string): string;
/**
 * Replace the version in a spec document content string.
 * Targets: > **文件版本**：v1.0
 */
export declare function replaceVersion(content: string, newVersion: string): string;
/**
 * Append a changelog entry to spec document content.
 * Inserts under the existing ## Changelog section if present,
 * otherwise appends at the end.
 */
export declare function appendChangelog(content: string, version: string, date: string, entries: string[]): string;
//# sourceMappingURL=version-manager.d.ts.map