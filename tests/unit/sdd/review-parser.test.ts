// Unit tests for sdd/review-parser.ts
import {
  parseIssues,
  getOpenIssues,
  parseReviewedVersion,
  parseReviewedAt,
} from "../../../src/modules/sdd/review-parser";

const SAMPLE_REVIEW = `# Test Module 規格審查報告

> **審查版本**：v1.0
> **審查日期**：2026-03-22
> **審查者**：dispatch worker (opus)

## 問題清單

| RV-ID | 章節 | 問題類型 | 問題描述 | 嚴重度 | 狀態 |
|-------|------|---------|---------|-------|------|
| RV-001 | 4.2 | 模糊 | 未定義錯誤格式 | 高 | OPEN |
| RV-002 | 3.1 | 矛盾 | 說明前後矛盾 | 中 | RESOLVED (v1.1) |
| RV-003 | 2.1 | 遺漏 | 缺少使用者故事 | 低 | OPEN |
`;

describe("parseReviewedVersion", () => {
  it("extracts reviewed version", () => {
    expect(parseReviewedVersion(SAMPLE_REVIEW)).toBe("v1.0");
  });

  it("returns v1.0 as default", () => {
    expect(parseReviewedVersion("no version")).toBe("v1.0");
  });
});

describe("parseReviewedAt", () => {
  it("extracts review date", () => {
    expect(parseReviewedAt(SAMPLE_REVIEW)).toBe("2026-03-22");
  });
});

describe("parseIssues", () => {
  it("parses all 3 issues", () => {
    const issues = parseIssues(SAMPLE_REVIEW);
    expect(issues).toHaveLength(3);
  });

  it("parses OPEN issue correctly", () => {
    const issues = parseIssues(SAMPLE_REVIEW);
    const rv001 = issues.find((i) => i.id === "RV-001");
    expect(rv001).toBeDefined();
    expect(rv001!.status).toBe("OPEN");
    expect(rv001!.severity).toBe("高");
  });

  it("parses RESOLVED issue with version", () => {
    const issues = parseIssues(SAMPLE_REVIEW);
    const rv002 = issues.find((i) => i.id === "RV-002");
    expect(rv002).toBeDefined();
    expect(rv002!.status).toBe("RESOLVED");
    expect(rv002!.resolved_in).toBe("v1.1");
  });
});

describe("getOpenIssues", () => {
  it("AC-05: returns only OPEN issues", () => {
    const open = getOpenIssues(SAMPLE_REVIEW);
    expect(open).toHaveLength(2);
    expect(open.map((i) => i.id)).toEqual(["RV-001", "RV-003"]);
  });

  it("AC-07: returns empty when all resolved", () => {
    const allResolved = SAMPLE_REVIEW
      .replace("| OPEN |", "| RESOLVED (v1.1) |")
      .replace(/\| OPEN \|/g, "| RESOLVED (v1.1) |");
    expect(getOpenIssues(allResolved)).toHaveLength(0);
  });

  it("returns empty for content with no table", () => {
    expect(getOpenIssues("# No issues here")).toHaveLength(0);
  });
});
