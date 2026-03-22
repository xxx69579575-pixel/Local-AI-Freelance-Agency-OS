// Integration tests: intake → dispatch workflow
import { jest } from "@jest/globals";

// Shared file store
const fsStore = new Map<string, string>();

const mockCreate = jest.fn();
const mockWriteFile = jest.fn<(p: string, c: string) => Promise<void>>();
const mockAtomicWrite = jest.fn<(p: string, c: string) => Promise<void>>();
const mockReadFile = jest.fn<(p: string) => Promise<string | null>>();
const mockFileExists = jest.fn<(p: string) => Promise<boolean>>();
const mockRenderTemplate = jest.fn<(path: string, vars: Record<string, string>) => Promise<string>>();

jest.unstable_mockModule("@anthropic-ai/sdk", () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

jest.unstable_mockModule("../../src/utils/file-writer.js", () => ({
  writeFile: mockWriteFile,
  atomicWrite: mockAtomicWrite,
  readFile: mockReadFile,
  fileExists: mockFileExists,
}));

jest.unstable_mockModule("../../src/modules/dispatch/template-engine.js", () => ({
  renderTemplate: mockRenderTemplate,
}));

jest.unstable_mockModule("../../src/config.js", () => ({
  CONFIG: {
    models: { opus: "claude-opus-4-6", sonnet: "claude-sonnet-4-6", haiku: "claude-haiku-4-5" },
    paths: { intake: "docs/intake", dispatch: ".dispatch/tasks", templates: ".dispatch/templates" },
    ipc: { questionTimeoutMs: 180000 },
    ai: { maxRetries: 2, totalAttempts: 3 },
  },
  DISPATCH_ALIASES: [
    "intake","write-spec","review-spec","update-spec","implement",
    "add-feature","fix-bug","write-tests","code-review","qa-check",
    "security-audit","deploy-vercel","summarize",
  ],
}));

jest.unstable_mockModule("../../src/utils/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { runIntake } = await import("../../src/modules/intake/parser.js");
const { createTask, updateTaskStatus, getTask } = await import("../../src/modules/dispatch/task-runner.js");
const { parsePlan, markItemDone } = await import("../../src/modules/dispatch/plan-manager.js");

const VALID_RESPONSE = {
  project_name: "agency-os",
  version: "v1.0",
  created_at: "2026-01-01T00:00:00+08:00",
  background_summary: "An AI-powered freelance agency OS.",
  mvp_features: [
    { id: "M1", name: "Intake", description: "Collect requirements", priority: "MVP", phase: "1.1", complexity: "medium" },
    { id: "M2", name: "Dispatch", description: "Dispatch tasks", priority: "MVP", phase: "1.2", complexity: "high" },
  ],
  nice_to_have_features: [
    { id: "N1", name: "Dashboard", description: "Web UI", priority: "nice-to-have", phase: "2.2", complexity: "medium" },
  ],
  risks: [{ id: "R1", description: "API rate limits", severity: "medium", mitigation: "Retry logic" }],
  implementation_order: ["M1", "M2"],
  next_actions: [
    { priority: "P0", task: "Write spec", dispatch_alias: "write-spec", model: "opus" },
  ],
};

let slugCounter = 0;
const uid = (p: string) => `${p}-it-${++slugCounter}`;

beforeEach(() => {
  fsStore.clear();
  mockCreate.mockReset();
  mockWriteFile.mockReset();
  mockAtomicWrite.mockReset();
  mockReadFile.mockReset();
  mockFileExists.mockReset();
  mockRenderTemplate.mockReset();

  // Default: return valid AI response
  mockCreate.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(VALID_RESPONSE) }] });

  // File store implementations
  mockWriteFile.mockImplementation(async (p, c) => { fsStore.set(p.replace(/\\/g, "/"), c); });
  mockAtomicWrite.mockImplementation(async (p, c) => { fsStore.set(p.replace(/\\/g, "/"), c); });
  mockReadFile.mockImplementation(async (p) => fsStore.get(p.replace(/\\/g, "/")) ?? null);
  mockFileExists.mockImplementation(async (p) => fsStore.has(p.replace(/\\/g, "/")));

  // Template
  mockRenderTemplate.mockResolvedValue("# intake — 計劃文件\n\n- [ ] 解析輸入\n- [ ] 呼叫 AI 分析\n");
});

describe("Intake → Dispatch integration", () => {
  it("AC-01: runIntake creates a markdown file in docs/intake/", async () => {
    const result = await runIntake(
      { project_name: "Agency OS", description: "Build an AI freelance OS" },
      "docs/intake",
    );
    expect(result.outputPath).toMatch(/docs\/intake\/.+\.md$/);
    expect(fsStore.has(result.outputPath.replace(/\\/g, "/"))).toBe(true);
  });

  it("AC-07: intake frontmatter is parseable by downstream task", async () => {
    const result = await runIntake(
      { project_name: "Agency OS", description: "Build an AI freelance OS" },
      "docs/intake",
    );
    const content = fsStore.get(result.outputPath.replace(/\\/g, "/"))!;
    const parts = content.split("---");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const fm = parts[1]!;
    expect(fm).toContain("project_name:");
    expect(fm).toContain("intake_slug:");
    expect(fm).toContain('"agency-os"');
  });

  it("AC-03 + full workflow: intake → dispatch task created and completed", async () => {
    const intakeResult = await runIntake(
      { project_name: "Agency OS", description: "Build" },
      "docs/intake",
    );
    expect(intakeResult.output.next_actions[0]!.dispatch_alias).toBe("write-spec");

    const slug = uid("write-spec-agency-os");
    const task = await createTask("write-spec", "agency-os", slug, "opus");
    expect(task.status).toBe("pending");

    const planPath = task.plan_path.replace(/\\/g, "/");
    expect(fsStore.has(planPath)).toBe(true);

    updateTaskStatus(task.id, "running");
    const planContent = fsStore.get(planPath)!;
    const items = parsePlan(planContent);
    expect(items[0]!.status).toBe("todo");

    await markItemDone(planPath, 0, "parsed input");
    expect(fsStore.get(planPath)!).toContain("- [x] 解析輸入");

    const done = updateTaskStatus(task.id, "done", { output_path: "docs/specs/agency-os.md" });
    expect(done.status).toBe("done");
    expect(getTask(task.id)!.status).toBe("done");
  });

  it("AC-09: concurrent tasks have isolated plan.md files", async () => {
    const slug1 = uid("write-spec-p1");
    const slug2 = uid("implement-p2");
    const task1 = await createTask("write-spec", "p1", slug1, "opus");
    const task2 = await createTask("implement", "p2", slug2, "sonnet");

    const plan1 = task1.plan_path.replace(/\\/g, "/");
    const plan2 = task2.plan_path.replace(/\\/g, "/");
    expect(plan1).not.toBe(plan2);

    await markItemDone(plan1, 0, "task1 done");
    const p1Items = parsePlan(fsStore.get(plan1)!);
    const p2Items = parsePlan(fsStore.get(plan2)!);
    expect(p1Items[0]!.status).toBe("done");
    expect(p2Items[0]!.status).toBe("todo");
  });

  it("AC-06: re-running intake with same project_name overwrites the file", async () => {
    await runIntake({ project_name: "Agency OS", description: "First" }, "docs/intake");
    const keysAfterFirst = [...fsStore.keys()].filter((k) => k.includes("agency-os.md"));
    expect(keysAfterFirst).toHaveLength(1);

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ ...VALID_RESPONSE, background_summary: "Updated" }) }],
    });
    await runIntake({ project_name: "Agency OS", description: "Second" }, "docs/intake");

    const keysAfterSecond = [...fsStore.keys()].filter((k) => k.includes("agency-os.md"));
    expect(keysAfterSecond).toHaveLength(1);
    expect(fsStore.get(keysAfterSecond[0]!)!).toContain("Updated");
  });
});
