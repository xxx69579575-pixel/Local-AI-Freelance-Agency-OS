// Agency OS — HTTP server entry point
// Mounts intake and dispatch API routes, exposes health check at GET /
import http from "node:http";
import { handleDispatchRequest } from "./modules/dispatch/api.js";
import { handleIntakeRequest } from "./modules/intake/api.js";
import { logger } from "./utils/logger.js";

export async function requestHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  // Health check
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "Local AI Freelance Agency OS",
        version: "1.0.0",
      }),
    );
    return;
  }

  // Dispatch routes: POST /api/dispatch, GET /api/dispatch/tasks, etc.
  const handled = await handleDispatchRequest(req, res);
  if (handled) return;

  // Intake route: POST /api/intake (returns 404 for all other paths)
  handleIntakeRequest(req, res);
}

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

export const server = http.createServer((req, res) => {
  requestHandler(req, res).catch((err: unknown) => {
    logger.error("Unhandled request error", {
      error: (err as Error).message,
    });
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ status: "error", message: "Internal server error" }),
      );
    }
  });
});

server.listen(PORT, () => {
  logger.info(`Agency OS API server listening on port ${PORT}`);
});
