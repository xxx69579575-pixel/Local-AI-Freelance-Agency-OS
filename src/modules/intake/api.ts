// Intake module — REST API handler (Phase 2.2)
// POST /api/intake — accepts intake form data and returns structured output
import http from "node:http";
import { runIntake } from "./parser.js";
import { logger } from "../../utils/logger.js";
import type { IntakeInput } from "../../types/intake.js";

/**
 * Handle an intake API request directly (for use in a combined server).
 */
export function handleIntakeRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  handleRequest(req, res).catch((err: unknown) => {
    logger.error("Unhandled API error", { error: (err as Error).message });
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ status: "error", message: "Internal server error" }),
      );
    }
  });
}

/**
 * Create and return an http.Server that handles intake API requests.
 * Call server.listen(port) to start.
 */
export function createIntakeServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      logger.error("Unhandled API error", { error: (err as Error).message });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ status: "error", message: "Internal server error" }),
        );
      }
    });
  });
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (req.method !== "POST" || req.url !== "/api/intake") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", message: "Not found" }));
    return;
  }

  let body: string;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", message: "Failed to read request body" }));
    return;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body) as Record<string, unknown>;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", message: "Invalid JSON body" }));
    return;
  }

  const { project_name, description, deadline, budget, tech_constraints } = data;

  if (!project_name || typeof project_name !== "string" || project_name.trim() === "") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "error",
        message: "project_name and description are required",
      }),
    );
    return;
  }

  if (!description || typeof description !== "string" || description.trim() === "") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "error",
        message: "project_name and description are required",
      }),
    );
    return;
  }

  const intakeInput: IntakeInput = {
    project_name: project_name.trim(),
    description: description.trim(),
    deadline:
      typeof deadline === "string" && deadline.length > 0
        ? deadline
        : undefined,
    budget:
      typeof budget === "string" && budget.length > 0 ? budget : undefined,
    tech_constraints: Array.isArray(tech_constraints)
      ? tech_constraints.map(String)
      : undefined,
  };

  try {
    const result = await runIntake(intakeInput);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "success",
        output_path: result.outputPath,
        summary: result.output,
      }),
    );
    logger.info("Intake API request completed", {
      output_path: result.outputPath,
    });
  } catch (err) {
    logger.error("Intake processing failed", { error: (err as Error).message });
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "error", message: (err as Error).message }),
    );
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}
