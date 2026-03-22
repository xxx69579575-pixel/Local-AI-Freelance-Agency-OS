// Unit tests for intake/parser.ts
// Covers: AC-01, AC-06, AC-08
import { jest } from "@jest/globals";

const mockCreate = jest.fn();
const mockWriteFile = jest.fn<(p: string, c: string) => Promise<void>>();

jest.unstable_mockModule("@anthropic-ai/sdk", () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

jest.unstable_mockModule("../../../src/utils/file-writer.js", () => ({
  writeFile: mockWriteFile,
  fileExists: jest.fn(),
  atomicWrite: jest.fn(),
  readFile: jest.fn(),
}));

jest.unstable_mockModule("../../../src/utils/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule("../../../src/config.js", () => ({
  CONFIG: {
    models: { opus: "claude-opus-4-6", sonnet: "claude-sonnet-4-6", haiku: "claude-haiku-4-5" },
    paths: { intake: "docs/intake" },
    ai: { maxRetries: 2, totalAttempts: 3 },
  },
  DISPATCH_ALIASES: [
    "intake","write-spec","review-spec","update-spec","implement",
    "add-feature","fix-bug","write-tests","code-review","qa-check",
    "security-audit","deploy-vercel","summarize",
  ],
}));

const { runIntake } = await import("../../../src/modules/intake/parser.js");
const { AIParseError } = await import("../../../src/utils/errors.js");

const VALID = {
  project_name: "test-project",
  version: "v1.0",
  created_at: "2026-01-01T00:00:00+08:00",
  background_summary: "A test project.",
  mvp_features: [{ id: "M1", name: "Auth", description: "Login", priority: "MVP", phase: "1.1", complexity: "medium" }],
  nice_to_have_features: [],
  risks: [{ id: "R1", description: "Risk", severity: "high", mitigation: "CDN" }],
  implementation_order: ["M1"],
  next_actions: [{ priority: "P0", task: "Setup", dispatch_alias: "write-spec", model: "opus" }],
};

beforeEach(() => {
  mockCreate.mockReset();
  mockWriteFile.mockReset();
  mockWriteFile.mockResolvedValue(undefined);
});

function aiOk(r = VALID): void {
  mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(r) }] });
}

describe("runIntake", () => {
  it("AC-01: writes output file to the intake dir", async () => {
    aiOk();
    const result = await runIntake({ project_name: "test-project", description: "Build an app" }, "docs/intake");
    expect(mockWriteFile).toHaveBeenCalled();
    const calledPath = String(mockWriteFile.mock.calls[0]![0]);
    expect(calledPath).toContain("docs/intake");
    expect(calledPath).toMatch(/\.md$/);
    expect(result.outputPath).toMatch(/docs\/intake\/.+\.md/);
  });

  it("AC-06: same project_name → same slug (overwrite)", async () => {
    // AI response has project_name "test-project" → slug is "test-project"
    aiOk();
    const result = await runIntake({ project_name: "Test Project", description: "Build" }, "docs/intake");
    expect(result.outputPath).toContain("test-project.md");
    expect(result.outputPath).not.toContain("-2");
  });

  it("AC-08: retries on 1st failure, succeeds on 2nd", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));
    aiOk();
    const result = await runIntake({ project_name: "test-project", description: "Build" }, "docs/intake");
    expect(result.output.project_name).toBeTruthy();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("AC-08: bad JSON on 1+2, succeeds on 3rd", async () => {
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: "text", text: "not json" }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "bad" }] });
    aiOk();
    const result = await runIntake({ project_name: "test-project", description: "Build" }, "docs/intake");
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.output).toBeDefined();
  });

  it("AC-08: all 3 fail → AIParseError, no file written", async () => {
    mockCreate.mockRejectedValue(new Error("timeout"));
    await expect(
      runIntake({ project_name: "test-project", description: "Build" }, "docs/intake"),
    ).rejects.toThrow(AIParseError);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("AC-08: bad JSON all 3 → AIParseError, no file written", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "{bad" }] });
    await expect(
      runIntake({ project_name: "test-project", description: "Build" }, "docs/intake"),
    ).rejects.toThrow(AIParseError);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("invalid dispatch_alias → replaced with 'write-spec'", async () => {
    aiOk({ ...VALID, next_actions: [{ priority: "P0", task: "X", dispatch_alias: "invalid", model: "opus" }] });
    const result = await runIntake({ project_name: "test-project", description: "Build" }, "docs/intake");
    expect(result.output.next_actions[0]!.dispatch_alias).toBe("write-spec");
  });
});
