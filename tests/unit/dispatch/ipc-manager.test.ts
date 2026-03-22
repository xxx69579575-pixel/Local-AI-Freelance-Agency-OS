// Unit tests for dispatch/ipc-manager.ts
// Covers: AC-04 (question file), AC-06 (timeout detection), AC-07 (atomic answer write)
import { jest } from "@jest/globals";

const writtenFiles = new Map<string, string>();

const mockAtomicWrite = jest.fn<(p: string, c: string) => Promise<void>>();
const mockReadFile = jest.fn<(p: string) => Promise<string | null>>();
const mockFileExists = jest.fn<(p: string) => Promise<boolean>>();

jest.unstable_mockModule("../../../src/utils/file-writer.js", () => ({
  atomicWrite: mockAtomicWrite,
  readFile: mockReadFile,
  fileExists: mockFileExists,
  writeFile: jest.fn(),
}));

jest.unstable_mockModule("../../../src/config.js", () => ({
  CONFIG: {
    paths: { dispatch: ".dispatch/tasks" },
    ipc: { questionTimeoutMs: 180000 },
  },
}));

const { askAndPause, checkPendingAnswer, writeAnswer, isQuestionTimedOut } =
  await import("../../../src/modules/dispatch/ipc-manager.js");
const { WaitingForInputError } = await import("../../../src/utils/errors.js");

function resetMocks(): void {
  mockAtomicWrite.mockReset();
  mockReadFile.mockReset();
  mockFileExists.mockReset();
  writtenFiles.clear();

  mockAtomicWrite.mockImplementation(async (p: string, c: string) => {
    writtenFiles.set(p.replace(/\\/g, "/"), c);
  });
}

describe("askAndPause", () => {
  beforeEach(resetMocks);

  it("AC-04: writes question file atomically and throws WaitingForInputError", async () => {
    await expect(
      askAndPause("my-task", 1, "What is the dir?", "Need to know output path"),
    ).rejects.toThrow(WaitingForInputError);
    const written = [...writtenFiles.keys()].find((k) => k.includes("001.question"));
    expect(written).toBeTruthy();
  });

  it("AC-04: question file contains expected fields", async () => {
    await expect(
      askAndPause("my-task", 1, "What is the dir?", "Need context", ["A", "B"]),
    ).rejects.toThrow(WaitingForInputError);
    const content = [...writtenFiles.values()][0]!;
    expect(content).toContain("**問題**：What is the dir?");
    expect(content).toContain("**背景**：Need context");
    expect(content).toContain("**等待截止**：");
    expect(content).toContain("A) A");
    expect(content).toContain("B) B");
  });

  it("sequence number is zero-padded to 3 digits", async () => {
    await expect(askAndPause("my-task", 3, "Q?", "BG")).rejects.toThrow(WaitingForInputError);
    const written = [...writtenFiles.keys()].find((k) => k.includes("003.question"));
    expect(written).toBeTruthy();
  });
});

describe("writeAnswer", () => {
  beforeEach(resetMocks);

  it("AC-07: atomically writes answer file with correct content", async () => {
    await writeAnswer("my-task", 1, "Use docs/specs/");
    const written = [...writtenFiles.keys()].find((k) => k.includes("001.answer"));
    expect(written).toBeTruthy();
    expect(writtenFiles.get(written!)).toBe("Use docs/specs/");
  });

  it("AC-07: throws if answer is empty string", async () => {
    await expect(writeAnswer("my-task", 1, "")).rejects.toThrow("answer cannot be empty");
  });

  it("AC-07: throws if answer is only whitespace", async () => {
    await expect(writeAnswer("my-task", 1, "   ")).rejects.toThrow("answer cannot be empty");
  });
});

describe("checkPendingAnswer", () => {
  beforeEach(resetMocks);

  it("returns null when answer file does not exist", async () => {
    mockFileExists.mockResolvedValue(false);
    const result = await checkPendingAnswer("my-task", 1);
    expect(result).toBeNull();
  });

  it("returns null when answer file is empty (RV-017)", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue("   ");
    const result = await checkPendingAnswer("my-task", 1);
    expect(result).toBeNull();
  });

  it("returns trimmed answer when file has content", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue("  Use docs/specs/  ");
    const result = await checkPendingAnswer("my-task", 1);
    expect(result).toBe("Use docs/specs/");
  });

  it("writes .done marker when answer is valid", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue("Valid answer");
    await checkPendingAnswer("my-task", 1);
    const doneWritten = [...writtenFiles.keys()].find((k) => k.includes("001.done"));
    expect(doneWritten).toBeTruthy();
  });
});

describe("isQuestionTimedOut", () => {
  beforeEach(resetMocks);

  it("AC-06: returns true when deadline is in the past", async () => {
    const pastDeadline = new Date(Date.now() - 10000).toISOString();
    mockReadFile.mockResolvedValue(`**等待截止**：${pastDeadline}`);
    const result = await isQuestionTimedOut("my-task", 1);
    expect(result).toBe(true);
  });

  it("returns false when deadline is in the future", async () => {
    const futureDeadline = new Date(Date.now() + 180000).toISOString();
    mockReadFile.mockResolvedValue(`**等待截止**：${futureDeadline}`);
    const result = await isQuestionTimedOut("my-task", 1);
    expect(result).toBe(false);
  });

  it("returns false when question file does not exist", async () => {
    mockReadFile.mockResolvedValue(null);
    const result = await isQuestionTimedOut("my-task", 1);
    expect(result).toBe(false);
  });
});
