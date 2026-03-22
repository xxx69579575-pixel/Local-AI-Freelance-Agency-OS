// Unit tests for sdd/spec-gate.ts
// Covers AC-01 through AC-05, AC-07, AC-12
import { jest } from "@jest/globals";

// --- Mocks ---
const mockFileExists = jest.fn<(p: string) => Promise<boolean>>();
const mockReadFile = jest.fn<(p: string) => Promise<string | null>>();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule("../../../src/utils/file-writer.js", () => ({
  fileExists: mockFileExists,
  readFile: mockReadFile,
  writeFile: jest.fn(),
  atomicWrite: jest.fn(),
}));

jest.unstable_mockModule("../../../src/utils/logger.js", () => ({
  logger: mockLogger,
}));

jest.unstable_mockModule("../../../src/config.js", () => ({
  CONFIG: {
    paths: {
      specs: "docs/specs",
      specReviews: "docs/specs/review",
      intake: "docs/intake",
      dispatch: ".dispatch/tasks",
      templates: ".dispatch/templates",
      src: "src",
      tests: "tests",
    },
    models: { opus: "claude-opus-4-6", sonnet: "claude-sonnet-4-6", haiku: "claude-haiku-4-5-20251001" },
    ipc: { questionTimeoutMs: 180000 },
    ai: { maxRetries: 2, totalAttempts: 3 },
  },
}));

const { runSpecGate } = await import("../../../src/modules/sdd/spec-gate.js");

const V11_SPEC = `> **文件版本**：v1.1

## 1. 目標與範圍（Goals & Scope）
content
## 2. 使用者故事（User Stories）
content
## 3. 功能規格（Functional Spec）
content
## 4. 技術規格（Technical Spec）
content
## 5. 驗收標準（Acceptance Criteria）
content
`;

const V10_SPEC = V11_SPEC.replace("v1.1", "v1.0");

const REVIEW_ALL_RESOLVED = `> **審查版本**：v1.0
## 問題清單
| RV-ID | 章節 | 問題類型 | 問題描述 | 嚴重度 | 狀態 |
|-------|------|---------|---------|-------|------|
| RV-001 | 4.2 | 模糊 | desc | 高 | RESOLVED (v1.1) |
`;

const REVIEW_HAS_OPEN = `> **審查版本**：v1.0
## 問題清單
| RV-ID | 章節 | 問題類型 | 問題描述 | 嚴重度 | 狀態 |
|-------|------|---------|---------|-------|------|
| RV-001 | 4.2 | 模糊 | desc | 高 | OPEN |
`;

beforeEach(() => {
  mockFileExists.mockReset();
  mockReadFile.mockReset();
  mockLogger.warn.mockReset();
});

describe("runSpecGate", () => {
  it("AC-01: fails when spec file does not exist", async () => {
    mockFileExists.mockResolvedValue(false);
    const result = await runSpecGate("missing-module");
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === "file_exists");
    expect(check?.passed).toBe(false);
  });

  it("AC-02: fails when spec version is v1.0", async () => {
    mockFileExists.mockImplementation(async (p) => String(p).endsWith(".md"));
    mockReadFile.mockResolvedValue(V10_SPEC);
    const result = await runSpecGate("test-module");
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === "version_reviewed");
    expect(check?.passed).toBe(false);
  });

  it("AC-03: fails when required sections are missing", async () => {
    const noSection4 = V11_SPEC.replace("## 4. 技術規格（Technical Spec）\ncontent\n", "");
    mockFileExists.mockImplementation(async (p) => {
      const ps = String(p);
      return ps.includes("docs/specs") && !ps.includes("review");
    });
    mockReadFile.mockResolvedValue(noSection4);
    const result = await runSpecGate("test-module", false);
    const check = result.checks.find((c) => c.name === "required_sections");
    expect(check?.passed).toBe(false);
    expect(check?.message).toContain("4");
  });

  it("AC-04: fails when review file does not exist", async () => {
    mockFileExists.mockImplementation(async (p) => {
      const ps = String(p);
      return ps.endsWith("test-module.md"); // only spec exists, no review
    });
    mockReadFile.mockResolvedValue(V11_SPEC);
    const result = await runSpecGate("test-module");
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === "review_file_exists");
    expect(check?.passed).toBe(false);
  });

  it("AC-05: fails when review has OPEN issues", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockImplementation(async (p) => {
      return String(p).includes("review") ? REVIEW_HAS_OPEN : V11_SPEC;
    });
    const result = await runSpecGate("test-module");
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === "open_issues");
    expect(check?.passed).toBe(false);
    expect(check?.message).toContain("RV-001");
  });

  it("AC-07: passes when all review issues are RESOLVED", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockImplementation(async (p) => {
      return String(p).includes("review") ? REVIEW_ALL_RESOLVED : V11_SPEC;
    });
    const result = await runSpecGate("test-module");
    expect(result.passed).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("AC-12: impl alias forces require_reviewed=true even when false passed", async () => {
    mockFileExists.mockImplementation(async (p) => {
      const ps = String(p);
      return ps.endsWith("test-module.md"); // review file missing
    });
    mockReadFile.mockResolvedValue(V11_SPEC);
    const result = await runSpecGate("test-module", false, "implement");
    // Should check review file despite require_reviewed=false
    const reviewCheck = result.checks.find((c) => c.name === "review_file_exists");
    expect(reviewCheck).toBeDefined();
    expect(result.passed).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("passes with require_reviewed=false when only spec exists and sections complete", async () => {
    mockFileExists.mockImplementation(async (p) => {
      const ps = String(p);
      return ps.endsWith("test-module.md") && !ps.includes("review");
    });
    mockReadFile.mockResolvedValue(V11_SPEC);
    const result = await runSpecGate("test-module", false);
    expect(result.passed).toBe(true);
    // No review checks when require_reviewed=false
    expect(result.checks.find((c) => c.name === "review_file_exists")).toBeUndefined();
  });
});
