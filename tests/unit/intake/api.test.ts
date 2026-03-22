// Unit tests for intake/api.ts - Covers: AC-05
import { jest } from "@jest/globals";
import http from "node:http";

const mockRunIntake = jest.fn();

jest.unstable_mockModule("../../../src/modules/intake/parser.js", () => ({ runIntake: mockRunIntake }));
jest.unstable_mockModule("../../../src/utils/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { createIntakeServer } = await import("../../../src/modules/intake/api.js");

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
        res.on("end", () => {
          try { resolve({ status: res.statusCode!, body: JSON.parse(raw) }); }
          catch { reject(new Error(`Bad JSON: ${raw}`)); }
        });
      },
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

describe("createIntakeServer", () => {
  let server: http.Server;

  beforeEach(async () => {
    mockRunIntake.mockReset();
    server = createIntakeServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    await new Promise<void>((r, j) => server.close((e) => e ? j(e) : r()));
  });

  it("AC-05: 400 when project_name missing", async () => {
    const { status, body } = await req(server, "POST", "/api/intake", { description: "Build" });
    expect(status).toBe(400);
    expect(String(body["message"])).toContain("required");
  });

  it("AC-05: 400 when description missing", async () => {
    const { status, body } = await req(server, "POST", "/api/intake", { project_name: "P" });
    expect(status).toBe(400);
    expect(body["status"]).toBe("error");
  });

  it("AC-05: 400 when both missing", async () => {
    const { status } = await req(server, "POST", "/api/intake", {});
    expect(status).toBe(400);
  });

  it("400 for invalid JSON body", async () => {
    const port = (server.address() as import("net").AddressInfo).port;
    const result = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const r = http.request(
        { hostname: "127.0.0.1", port, path: "/api/intake", method: "POST",
          headers: { "Content-Type": "application/json" } },
        (res) => {
          let raw = "";
          res.on("data", (c) => { raw += c; });
          res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(raw) }));
        },
      );
      r.on("error", reject);
      r.write("not-json");
      r.end();
    });
    expect(result.status).toBe(400);
  });

  it("200 on valid intake", async () => {
    mockRunIntake.mockResolvedValueOnce({ outputPath: "docs/intake/p.md", output: { project_name: "p" } });
    const { status, body } = await req(server, "POST", "/api/intake",
      { project_name: "P", description: "Build something" });
    expect(status).toBe(200);
    expect(body["status"]).toBe("success");
  });

  it("404 for unknown routes", async () => {
    const { status } = await req(server, "GET", "/unknown");
    expect(status).toBe(404);
  });

  it("500 when runIntake throws", async () => {
    mockRunIntake.mockRejectedValueOnce(new Error("AI failed"));
    const { status, body } = await req(server, "POST", "/api/intake",
      { project_name: "P", description: "Build" });
    expect(status).toBe(500);
    expect(body["status"]).toBe("error");
  });
});
