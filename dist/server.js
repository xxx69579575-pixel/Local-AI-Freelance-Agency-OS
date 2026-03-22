// Agency OS — HTTP server entry point
// Mounts intake, dispatch, and sdd API routes, exposes health check at GET /
import http from "node:http";
import { handleDispatchRequest } from "./modules/dispatch/api.js";
import { handleIntakeRequest } from "./modules/intake/api.js";
import { handleSddRequest } from "./modules/sdd/api.js";
import { logger } from "./utils/logger.js";
export async function requestHandler(req, res) {
    // Health check
    if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "ok",
            service: "Local AI Freelance Agency OS",
            version: "1.0.0",
        }));
        return;
    }
    // SDD routes: POST /api/sdd/spec-gate, GET /api/sdd/status, etc.
    if ((req.url ?? "").startsWith("/api/sdd")) {
        const handled = await handleSddRequest(req, res);
        if (handled)
            return;
    }
    // Dispatch routes: POST /api/dispatch, GET /api/dispatch/tasks, etc.
    const handled = await handleDispatchRequest(req, res);
    if (handled)
        return;
    // Intake route: POST /api/intake (returns 404 for all other paths)
    handleIntakeRequest(req, res);
}
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
export const server = http.createServer((req, res) => {
    requestHandler(req, res).catch((err) => {
        logger.error("Unhandled request error", {
            error: err.message,
        });
        if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", message: "Internal server error" }));
        }
    });
});
server.listen(PORT, () => {
    logger.info(`Agency OS API server listening on port ${PORT}`);
});
//# sourceMappingURL=server.js.map