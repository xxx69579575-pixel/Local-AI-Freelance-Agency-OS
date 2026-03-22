// Unit tests for sdd/spec-parser.ts
import {
  parseVersion,
  parseRequiredSections,
  parseAcceptanceCriteria,
} from "../../../src/modules/sdd/spec-parser";

const SAMPLE_SPEC = `<!-- 版本：v1.1 -->

# 測試模組規格文件 — test-module

> **文件版本**：v1.1
> **建立日期**：2026-01-01
> **方法論**：SDD

---

## 1. 目標與範圍（Goals & Scope）

### 1.1 目標
測試目標。

## 2. 使用者故事（User Stories）

| ID | 角色 | 故事 | 驗收條件摘要 |
|----|------|------|------------|
| US-01 | User | Story | AC |

## 3. 功能規格（Functional Spec）

功能說明。

## 4. 技術規格（Technical Spec）

技術說明。

## 5. 驗收標準（Acceptance Criteria）

| AC-ID | 條件 | 測試方式 |
|-------|------|---------|
| AC-01 | 系統回傳 200 | 直接呼叫 API |
| AC-02 | 錯誤時回傳 400 | 送出無效輸入 |
`;

describe("parseVersion", () => {
  it("parses v1.1 correctly", () => {
    expect(parseVersion(SAMPLE_SPEC)).toBe("v1.1");
  });

  it("returns v1.0 when no version found", () => {
    expect(parseVersion("# No version here")).toBe("v1.0");
  });

  it("parses v2.0", () => {
    expect(parseVersion("> **文件版本**：v2.0")).toBe("v2.0");
  });
});

describe("parseRequiredSections", () => {
  it("finds all 5 sections in complete spec", () => {
    const sections = parseRequiredSections(SAMPLE_SPEC);
    expect(sections).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("returns empty array for content with no sections", () => {
    expect(parseRequiredSections("# Title\n\nSome text")).toEqual([]);
  });

  it("AC-03: detects missing sections", () => {
    const noSection4 = SAMPLE_SPEC.replace(/^## 4\..*/m, "").replace(/技術說明。/, "");
    const sections = parseRequiredSections(noSection4);
    expect(sections).not.toContain("4");
    expect(sections).toContain("1");
    expect(sections).toContain("5");
  });
});

describe("parseAcceptanceCriteria", () => {
  it("extracts AC items from section 5", () => {
    const acs = parseAcceptanceCriteria(SAMPLE_SPEC);
    expect(acs).toHaveLength(2);
    expect(acs[0].id).toBe("AC-01");
    expect(acs[1].id).toBe("AC-02");
  });

  it("returns empty array when no section 5", () => {
    expect(parseAcceptanceCriteria("# No AC section")).toEqual([]);
  });

  it("includes description and test_method", () => {
    const acs = parseAcceptanceCriteria(SAMPLE_SPEC);
    expect(acs[0].description).toContain("200");
    expect(acs[0].test_method).toContain("API");
  });
});
