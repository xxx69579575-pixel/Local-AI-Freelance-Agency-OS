// SDD module — version number management (sdd-workflow.md § 3.4)

/**
 * Parse a version string into [major, minor] integers.
 * Returns [1, 0] for unrecognised or missing versions.
 */
export function parseVersionParts(version: string): [number, number] {
  const match = /^v(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return [1, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

/**
 * Compare two version strings.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareVersion(a: string, b: string): number {
  const [aMaj, aMin] = parseVersionParts(a);
  const [bMaj, bMin] = parseVersionParts(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  return aMin - bMin;
}

/**
 * Increment the minor version: v1.0 → v1.1, v1.2 → v1.3
 */
export function incrementMinorVersion(version: string): string {
  const [maj, min] = parseVersionParts(version);
  return `v${maj}.${min + 1}`;
}

/**
 * Increment the major version: v1.x → v2.0
 */
export function incrementMajorVersion(version: string): string {
  const [maj] = parseVersionParts(version);
  return `v${maj + 1}.0`;
}

/**
 * Replace the version in a spec document content string.
 * Targets: > **文件版本**：v1.0
 */
export function replaceVersion(content: string, newVersion: string): string {
  return content.replace(
    /(\*\*文件版本\*\*[：:])\s*v\d+\.\d+/,
    `$1 ${newVersion}`,
  );
}

/**
 * Append a changelog entry to spec document content.
 * Inserts under the existing ## Changelog section if present,
 * otherwise appends at the end.
 */
export function appendChangelog(
  content: string,
  version: string,
  date: string,
  entries: string[],
): string {
  const entryText =
    `### ${version} — ${date}\n` +
    entries.map((e) => `- ${e}`).join("\n");

  const changelogMatch = /^## Changelog\s*\n/m.exec(content);
  if (changelogMatch) {
    const insertAt = changelogMatch.index + changelogMatch[0].length;
    return content.slice(0, insertAt) + "\n" + entryText + "\n" + content.slice(insertAt);
  }

  return content.trimEnd() + "\n\n---\n\n## Changelog\n\n" + entryText + "\n";
}
