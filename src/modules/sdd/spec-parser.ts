// SDD module — spec document parser (sdd-workflow.md § 3.3, § 4.4)

export interface ACItem {
  id: string;
  description: string;
  test_method: string;
}

/**
 * Parse the version string from a spec document.
 * Looks for: > **文件版本**：v1.1
 */
export function parseVersion(content: string): string {
  const match = /\*\*文件版本\*\*[：:]\s*(v\d+\.\d+)/.exec(content);
  return match?.[1] ?? "v1.0";
}

/**
 * Parse which required section numbers (1–5) are present.
 * Supports Arabic numeral format: ## 1. or ## 1、
 * (§ 3.3 RV-024: only Arabic numerals for docs/specs/*.md)
 */
export function parseRequiredSections(content: string): string[] {
  const found: string[] = [];
  for (let i = 1; i <= 5; i++) {
    // Match ## 1. or ## 1、 at line start
    const regex = new RegExp(`^## ${i}[.、]`, "m");
    if (regex.test(content)) found.push(String(i));
  }
  return found;
}

/**
 * Parse all AC items from the ## 5. 驗收標準 table.
 */
export function parseAcceptanceCriteria(content: string): ACItem[] {
  const items: ACItem[] = [];
  // Find section 5 heading position
  const sectionIdx = content.search(/^## 5[.、]/m);
  if (sectionIdx === -1) return items;

  // Find the next section heading after section 5, if any
  const rest = content.slice(sectionIdx + 5);
  const nextMatch = /^## \d+[.、]/m.exec(rest);
  const sectionContent = nextMatch
    ? content.slice(sectionIdx, sectionIdx + 5 + nextMatch.index)
    : content.slice(sectionIdx);

  const lines = sectionContent.split("\n");
  for (const line of lines) {
    const cellMatch = /^\|\s*(AC-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (cellMatch) {
      items.push({
        id: cellMatch[1].trim(),
        description: cellMatch[2].trim(),
        test_method: cellMatch[3].trim(),
      });
    }
  }
  return items;
}

/**
 * Summarize an implementation directory's .ts files for drift-check prompts.
 * Returns a text summary of function/class signatures found.
 */
export function summarizeImplementation(files: Map<string, string>): string {
  const lines: string[] = [];
  for (const [filePath, content] of files) {
    const sigs: string[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("export function ") ||
        trimmed.startsWith("export async function ") ||
        trimmed.startsWith("export class ") ||
        trimmed.startsWith("export const ") ||
        trimmed.startsWith("export interface ") ||
        trimmed.startsWith("async function ") ||
        trimmed.startsWith("function ")
      ) {
        sigs.push(trimmed.slice(0, 120));
      }
    }
    if (sigs.length > 0) {
      lines.push(`\n### ${filePath}`);
      lines.push(...sigs.map((s) => `  ${s}`));
    }
  }
  return lines.join("\n");
}
