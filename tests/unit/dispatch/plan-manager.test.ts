// Unit tests for dispatch/plan-manager.ts
import { jest } from "@jest/globals";

const mockReadFile = jest.fn<(p: string) => Promise<string | null>>();
const mockWriteFile = jest.fn<(p: string, c: string) => Promise<void>>();

jest.unstable_mockModule("../../../src/utils/file-writer.js", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  atomicWrite: jest.fn(),
  fileExists: jest.fn(),
}));

const {
  parsePlan,
  updateItem,
  serializePlan,
  markItemDone,
  markItemQuestion,
  markItemError,
} = await import("../../../src/modules/dispatch/plan-manager.js");

const SAMPLE_PLAN = `# Test Task — 計劃文件

- [ ] 步驟一
- [ ] 步驟二
- [x] 步驟三 <!-- done at 12:00 -->
`;

describe("parsePlan", () => {
  it("parses todo items", () => {
    const items = parsePlan(SAMPLE_PLAN);
    expect(items[0]!.status).toBe("todo");
    expect(items[0]!.description).toBe("步驟一");
  });
  it("parses done items", () => {
    expect(parsePlan(SAMPLE_PLAN)[2]!.status).toBe("done");
  });
  it("parses note from completed item", () => {
    expect(parsePlan(SAMPLE_PLAN)[2]!.note).toBe("done at 12:00");
  });
  it("parses [?] as question", () => {
    expect(parsePlan("- [?] Q<!-- question: 確認 -->\n")[0]!.status).toBe("question");
  });
  it("parses [!] as error", () => {
    expect(parsePlan("- [!] E<!-- error: 失敗 -->\n")[0]!.status).toBe("error");
  });
  it("assigns sequential indices", () => {
    const items = parsePlan(SAMPLE_PLAN);
    expect(items[0]!.index).toBe(0);
    expect(items[2]!.index).toBe(2);
  });
  it("ignores non-checklist lines", () => {
    expect(parsePlan(SAMPLE_PLAN)).toHaveLength(3);
  });
});

describe("updateItem", () => {
  it("updates status and note for matching index", () => {
    const items = parsePlan(SAMPLE_PLAN);
    const updated = updateItem(items, 0, "done", "completed");
    expect(updated[0]!.status).toBe("done");
    expect(updated[0]!.note).toBe("completed");
  });
  it("does not modify other items", () => {
    const updated = updateItem(parsePlan(SAMPLE_PLAN), 0, "done");
    expect(updated[1]!.status).toBe("todo");
  });
});

describe("serializePlan", () => {
  it("round-trips: update → serialize → contains [x]", () => {
    const items = updateItem(parsePlan(SAMPLE_PLAN), 0, "done", "step 1 done");
    const result = serializePlan(SAMPLE_PLAN, items);
    expect(result).toContain("- [x] 步驟一");
    expect(result).toContain("step 1 done");
  });
  it("preserves heading", () => {
    expect(serializePlan(SAMPLE_PLAN, parsePlan(SAMPLE_PLAN))).toContain("# Test Task — 計劃文件");
  });
  it("serializes [?]", () => {
    const items = updateItem(parsePlan(SAMPLE_PLAN), 1, "question", "question: 確認");
    expect(serializePlan(SAMPLE_PLAN, items)).toContain("- [?] 步驟二");
  });
  it("serializes [!]", () => {
    const items = updateItem(parsePlan(SAMPLE_PLAN), 1, "error", "error: 失敗");
    expect(serializePlan(SAMPLE_PLAN, items)).toContain("- [!] 步驟二");
  });
});

describe("markItemDone / markItemQuestion / markItemError", () => {
  beforeEach(() => {
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockReadFile.mockResolvedValue(SAMPLE_PLAN);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("markItemDone writes [x] to file", async () => {
    await markItemDone("plan.md", 0, "finished");
    expect(mockWriteFile).toHaveBeenCalledWith("plan.md", expect.stringContaining("- [x] 步驟一"));
  });
  it("markItemQuestion writes [?] to file", async () => {
    await markItemQuestion("plan.md", 1, "需要確認");
    expect(mockWriteFile).toHaveBeenCalledWith("plan.md", expect.stringContaining("- [?] 步驟二"));
  });
  it("markItemError writes [!] to file", async () => {
    await markItemError("plan.md", 1, "無法解決");
    expect(mockWriteFile).toHaveBeenCalledWith("plan.md", expect.stringContaining("- [!] 步驟二"));
  });
});
