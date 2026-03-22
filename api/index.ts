// Vercel Serverless Function entry point
// Routes all requests to the Agency OS API handlers
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleDispatchRequest } from "../src/modules/dispatch/api.js";
import { handleIntakeRequest } from "../src/modules/intake/api.js";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
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

  // Dispatch routes
  const handled = await handleDispatchRequest(req, res);
  if (handled) return;

  // Intake route (also handles 404 for unmatched paths)
  handleIntakeRequest(req, res);
}
