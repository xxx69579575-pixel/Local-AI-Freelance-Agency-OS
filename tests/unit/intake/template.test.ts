// Unit tests for intake/template.ts
// Covers: AC-02 (YAML frontmatter + 7 sections), AC-07 (frontmatter parseable)
import { buildMarkdown } from "../../../src/modules/intake/template";
import type { IntakeOutput } from "../../../src/types/intake";

const SAMPLE_OUTPUT: IntakeOutput = {
  project_name: "my-project",
  version: "v1.0",
  created_at: "2026-01-01T00:00:00+08:00",
  background_summary: "A test project background.",
  mvp_features: [
    { id: "M1", name: "Auth", description: "Login functionality", priority: "MVP", phase: "1.1", complexity: "medium" },
  ],
  nice_to_have_features: [],
  risks: [
    { id: "R1", description: "Infra risk", severity: "high", mitigation: "Use CDN" },
  ],
  implementation_order: ["M1"],
  next_actions: [
    { priority: "P0", task: "Setup repo", dispatch_alias: "write-spec", model: "opus" },
  ],
};

describe("buildMarkdown", () => {
  it("AC-02: output contains YAML frontmatter block", () => {
    const md = buildMarkdown(SAMPLE_OUTPUT, "my-project");
    expect(md).toContain("---");
    expect(md).toContain('project_name: "my-project"');
    expect(md).toContain('version: "v1.0"');
    expect(md).toContain('intake_slug: "my-project"');
    expect(md).toContain("created_at:");
  });

  it("AC-02: output contains all 7 required sections", () => {
    const md = buildMarkdown(SAMPLE_OUTPUT, "my-project");
    expect(md).toContain("## 一、專案背景摘要");
    expect(md).toContain("## 二、MVP 功能清單（必要）");
    expect(md).toContain("## 三、Nice-to-Have 功能清單（可選）");
    expect(md).toContain("## 四、技術風險清單");
    expect(md).toContain("## 五、功能模組複雜度表");
    expect(md).toContain("## 六、建議實作優先順序");
    expect(md).toContain("## 七、下一步行動");
  });

  it("AC-03: MVP feature details rendered", () => {
    const md = buildMarkdown(SAMPLE_OUTPUT, "my-project");
    expect(md).toContain("M1");
    expect(md).toContain("Auth");
  });

  it("AC-04: risk items rendered with severity and mitigation", () => {
    const md = buildMarkdown(SAMPLE_OUTPUT, "my-project");
    expect(md).toContain("R1");
    expect(md).toContain("high");
    expect(md).toContain("Use CDN");
  });

  it("AC-07: frontmatter can be parsed by splitting on ---", () => {
    const md = buildMarkdown(SAMPLE_OUTPUT, "my-project");
    const parts = md.split("---");
    // parts[0] = empty, parts[1] = frontmatter, parts[2+] = body
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(parts[1]).toContain("project_name");
    expect(parts[1]).toContain("intake_slug");
  });

  it("Nice-to-Have section shows '_無_' when empty", () => {
    const md = buildMarkdown(SAMPLE_OUTPUT, "my-project");
    expect(md).toContain("_無_");
  });

  it("complexity table contains all feature IDs", () => {
    const outputWithBoth: IntakeOutput = {
      ...SAMPLE_OUTPUT,
      nice_to_have_features: [
        { id: "N1", name: "Dark mode", description: "", priority: "nice-to-have", phase: "2.1", complexity: "low" },
      ],
    };
    const md = buildMarkdown(outputWithBoth, "my-project");
    expect(md).toContain("| M1 |");
    expect(md).toContain("| N1 |");
  });
});
