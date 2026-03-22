// Unit tests for dispatch/task-runner.ts
import { jest } from "@jest/globals";

const mockWriteFile = jest.fn<(p: string, c: string) => Promise<void>>();
const mockAtomicWrite = jest.fn<(p: string, c: string) => Promise<void>>();
const mockFileExists = jest.fn<(p: string) => Promise<boolean>>();
const mockReadFile = jest.fn<(p: string) => Promise<string | null>>();
const mockRenderTemplate = jest.fn<(path: string, vars: Record<string, string>) => Promise<string>>();

jest.unstable_mockModule("../../../src/utils/file-writer.js", () => ({
  writeFile: mockWriteFile,
  atomicWrite: mockAtomicWrite,
  readFile: mockReadFile,
  fileExists: mockFileExists,
}));

jest.unstable_mockModule("../../../src/modules/dispatch/template-engine.js", () => ({
  renderTemplate: mockRenderTemplate,
}));

jest.unstable_mockModule("../../../src/config.js", () => ({
  CONFIG: {
    paths: { dispatch: ".dispatch/tasks" },
    ipc: { questionTimeoutMs: 180000 },
  },
  DISPATCH_ALIASES: [
    "intake","write-spec","review-spec","update-spec","implement",
    "add-feature","fix-bug","write-tests","code-review","qa-check",
    "security-audit","deploy-vercel","summarize",
  ],
}));

jest.unstable_mockModule("../../../src/utils/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { createTask, updateTaskStatus, getTask, listTasks, stopTask } =
  await import("../../../src/modules/dispatch/task-runner.js");

let slugCounter = 0;
const uid = (p: string) => `${p}-${++slugCounter}`;

beforeEach(() => {
  mockWriteFile.mockReset();
  mockAtomicWrite.mockReset();
  mockFileExists.mockReset();
  mockReadFile.mockReset();
  mockRenderTemplate.mockReset();

  mockWriteFile.mockResolvedValue(undefined);
  mockAtomicWrite.mockResolvedValue(undefined);
  mockFileExists.mockResolvedValue(false);
  mockRenderTemplate.mockResolvedValue("# Plan\n- [ ] Step 1\n");
});

describe("createTask", () => {
  it("AC-01: creates task with correct slug and plan_path", async () => {
    const slug = uid("write-spec");
    const task = await createTask("write-spec", "agency-os", slug, "opus");
    expect(task.slug).toBe(slug);
    expect(task.plan_path).toContain("plan.md");
    expect(task.plan_path).toContain(slug);
  });

  it("AC-01: writes plan.md", async () => {
    await createTask("write-spec", "ctx", uid("ws"), "opus");
    const planCall = mockWriteFile.mock.calls.find(([p]) => String(p).includes("plan.md"));
    expect(planCall).toBeDefined();
  });

  it("task ID is a valid UUID v4", async () => {
    const task = await createTask("implement", "login", uid("impl"), "sonnet");
    expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("AC-02: task starts with status=pending", async () => {
    const task = await createTask("intake", "ctx", uid("intake"), "opus");
    expect(task.status).toBe("pending");
  });
});

describe("updateTaskStatus", () => {
  it("AC-02: transitions pending → running", async () => {
    const task = await createTask("write-spec", "t", uid("ws"), "opus");
    expect(updateTaskStatus(task.id, "running").status).toBe("running");
  });

  it("AC-03: transitions running → done with output_path", async () => {
    const task = await createTask("write-spec", "t", uid("ws"), "opus");
    updateTaskStatus(task.id, "running");
    const done = updateTaskStatus(task.id, "done", { output_path: "docs/specs/done.md" });
    expect(done.status).toBe("done");
    expect(done.output_path).toBe("docs/specs/done.md");
  });

  it("throws for non-existent task id", () => {
    expect(() => updateTaskStatus("nonexistent-id-zzz", "running")).toThrow("Task not found");
  });
});

describe("getTask / listTasks", () => {
  it("getTask returns the task by id", async () => {
    const slug = uid("intake-ctx");
    const task = await createTask("intake", "ctx", slug, "opus");
    const found = getTask(task.id);
    expect(found).toBeDefined();
    expect(found!.slug).toBe(slug);
  });

  it("AC-10: listTasks includes newly created tasks", async () => {
    const before = listTasks().length;
    await createTask("summarize", "x", uid("sum"), "sonnet");
    expect(listTasks().length).toBeGreaterThan(before);
  });
});

describe("stopTask", () => {
  it("pending task → cancelled, context_saved=false", async () => {
    const task = await createTask("write-spec", "s1", uid("ws-s1"), "opus");
    const result = await stopTask(task.id);
    expect(result.status).toBe("cancelled");
    expect(result.context_saved).toBe(false);
  });

  it("running task without context → stopped, context_saved=false", async () => {
    const task = await createTask("write-spec", "s2", uid("ws-s2"), "opus");
    updateTaskStatus(task.id, "running");
    const result = await stopTask(task.id);
    expect(result.status).toBe("stopped");
    expect(result.context_saved).toBe(false);
  });

  it("running task with context → stopped, context_saved=true", async () => {
    const task = await createTask("write-spec", "s3", uid("ws-s3"), "opus");
    updateTaskStatus(task.id, "running", { context: "Step 2 done" });
    mockFileExists.mockResolvedValue(false);
    const result = await stopTask(task.id);
    expect(result.status).toBe("stopped");
    expect(result.context_saved).toBe(true);
  });

  it("done task → deleted, context_saved=false", async () => {
    const task = await createTask("write-spec", "s4", uid("ws-s4"), "opus");
    updateTaskStatus(task.id, "running");
    updateTaskStatus(task.id, "done");
    const result = await stopTask(task.id);
    expect(result.status).toBe("deleted");
    expect(result.context_saved).toBe(false);
  });

  it("throws for non-existent task", async () => {
    await expect(stopTask("no-such-id-abc")).rejects.toThrow("Task not found");
  });
});
