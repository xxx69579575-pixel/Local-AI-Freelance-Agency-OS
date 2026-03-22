// Unit tests for dispatch/api.ts
import { jest } from "@jest/globals";
import http from "node:http";

const mockCreateTask = jest.fn();
const mockUpdateTaskStatus = jest.fn();
const mockGetTask = jest.fn();
const mockListTasks = jest.fn();
const mockStopTask = jest.fn();
const mockParseDispatchCommand = jest.fn();
const mockResolveTaskSlug = jest.fn();
const mockWriteAnswer = jest.fn();
const mockIsQuestionTimedOut = jest.fn();
const mockReadQuestion = jest.fn();

jest.unstable_mockModule("../../../src/modules/dispatch/task-runner.js", () => ({
  createTask: mockCreateTask,
  updateTaskStatus: mockUpdateTaskStatus,
  getTask: mockGetTask,
  listTasks: mockListTasks,
  stopTask: mockStopTask,
  loadTasks: jest.fn(),
}));

jest.unstable_mockModule("../../../src/modules/dispatch/command-parser.js", () => ({
  parseDispatchCommand: mockParseDispatchCommand,
  resolveTaskSlug: mockResolveTaskSlug,
}));

jest.unstable_mockModule("../../../src/modules/dispatch/ipc-manager.js", () => ({
  writeAnswer: mockWriteAnswer,
  isQuestionTimedOut: mockIsQuestionTimedOut,
  readQuestion: mockReadQuestion,
}));

jest.unstable_mockModule("../../../src/utils/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule("../../../src/config.js", () => ({
  CONFIG: { paths: { dispatch: ".dispatch/tasks" }, ipc: { questionTimeoutMs: 180000 } },
}));

const { handleDispatchRequest } = await import("../../../src/modules/dispatch/api.js");
const { InvalidAliasError } = await import("../../../src/utils/errors.js");

const BASE = {
  id: "task-uuid", slug: "write-spec-test", alias: "write-spec", model: "opus" as const,
  status: "pending" as const,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  plan_path: ".dispatch/tasks/write-spec-test/plan.md",
};

function mkServer(): http.Server {
  return http.createServer(async (req, res) => {
    const handled = await handleDispatchRequest(req, res);
    if (!handled) { res.writeHead(404); res.end('{"status":"error"}'); }
  });
}

function req(
  server: http.Server, method: string, path: string, body?: object,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as import("net").AddressInfo).port;
    const data = body ? JSON.stringify(body) : "";
    const r = http.request(
      { hostname: "127.0.0.1", port, path, method,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(raw || "{}") }));
      },
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

describe("dispatch API", () => {
  let server: http.Server;

  beforeEach(async () => {
    [mockCreateTask, mockUpdateTaskStatus, mockGetTask, mockListTasks, mockStopTask,
     mockParseDispatchCommand, mockResolveTaskSlug, mockWriteAnswer,
     mockIsQuestionTimedOut, mockReadQuestion].forEach((m) => m.mockReset());

    mockReadQuestion.mockResolvedValue(null);
    mockIsQuestionTimedOut.mockResolvedValue(false);

    server = mkServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  });

  afterEach(async () => {
    await new Promise<void>((r, j) => server.close((e) => e ? j(e) : r()));
  });

  it("AC-02: POST /api/dispatch creates task with status=running", async () => {
    mockParseDispatchCommand.mockReturnValue({ alias: "write-spec", context: "test", model: "opus" });
    mockResolveTaskSlug.mockResolvedValue("write-spec-test");
    mockCreateTask.mockResolvedValue({ ...BASE });
    mockUpdateTaskStatus.mockReturnValue({ ...BASE, status: "running" });

    const { status, body } = await req(server, "POST", "/api/dispatch", { alias: "write-spec", context: "test" });
    expect(status).toBe(201);
    expect(body["status"]).toBe("running");
    expect(body["task_id"]).toBe("task-uuid");
  });

  it("AC-08: invalid alias returns 400 with alias list", async () => {
    mockParseDispatchCommand.mockImplementation(() => {
      throw new InvalidAliasError("bad-alias", ["intake", "write-spec"]);
    });
    const { status, body } = await req(server, "POST", "/api/dispatch", { alias: "bad-alias" });
    expect(status).toBe(400);
    expect(String(body["message"])).toContain("write-spec");
  });

  it("missing alias returns 400", async () => {
    const { status, body } = await req(server, "POST", "/api/dispatch", {});
    expect(status).toBe(400);
    expect(String(body["message"])).toContain("alias is required");
  });

  it("AC-10: GET /api/dispatch/tasks returns all status counts", async () => {
    mockListTasks.mockReturnValue([
      { ...BASE, id: "1", status: "running" },
      { ...BASE, id: "2", status: "done" },
      { ...BASE, id: "3", status: "failed" },
    ]);
    const { status, body } = await req(server, "GET", "/api/dispatch/tasks");
    expect(status).toBe(200);
    expect(body["total"]).toBe(3);
    expect(body["running"]).toBe(1);
    expect(body["done"]).toBe(1);
    expect(body["failed"]).toBe(1);
    expect(body["timed_out"]).toBe(0);
    expect(body["waiting_input"]).toBe(0);
    expect(body["pending"]).toBe(0);
  });

  it("GET /api/dispatch/tasks/:id returns 404 for unknown", async () => {
    mockGetTask.mockReturnValue(undefined);
    const { status } = await req(server, "GET", "/api/dispatch/tasks/no-such");
    expect(status).toBe(404);
  });

  it("GET /api/dispatch/tasks/:id returns 200 with task", async () => {
    mockGetTask.mockReturnValue({ ...BASE, status: "running" });
    const { status, body } = await req(server, "GET", "/api/dispatch/tasks/task-uuid");
    expect(status).toBe(200);
    expect(body["task_id"]).toBe("task-uuid");
  });

  it("AC-07: POST answer writes .answer file", async () => {
    mockGetTask.mockReturnValue({ ...BASE, status: "waiting_input" });
    mockWriteAnswer.mockResolvedValue(undefined);
    const { status, body } = await req(server, "POST", "/api/dispatch/tasks/task-uuid/answer",
      { sequence: 1, answer: "Use docs/specs/" });
    expect(status).toBe(200);
    expect(body["status"]).toBe("ok");
    expect(mockWriteAnswer).toHaveBeenCalledWith("write-spec-test", 1, "Use docs/specs/");
  });

  it("POST answer empty → 400", async () => {
    mockGetTask.mockReturnValue({ ...BASE, status: "waiting_input" });
    mockWriteAnswer.mockRejectedValue(new Error("answer cannot be empty"));
    const { status, body } = await req(server, "POST", "/api/dispatch/tasks/task-uuid/answer",
      { sequence: 1, answer: "" });
    expect(status).toBe(400);
    expect(String(body["message"])).toContain("empty");
  });

  it("DELETE /api/dispatch/tasks/:id stops task", async () => {
    mockGetTask.mockReturnValue({ ...BASE, status: "running" });
    mockStopTask.mockResolvedValue({ status: "stopped", context_saved: false });
    const { status, body } = await req(server, "DELETE", "/api/dispatch/tasks/task-uuid");
    expect(status).toBe(200);
    expect(body["status"]).toBe("stopped");
  });
});
