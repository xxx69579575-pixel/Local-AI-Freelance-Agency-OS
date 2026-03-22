import http from "node:http";
/**
 * Handle an intake API request directly (for use in a combined server).
 */
export declare function handleIntakeRequest(req: http.IncomingMessage, res: http.ServerResponse): void;
/**
 * Create and return an http.Server that handles intake API requests.
 * Call server.listen(port) to start.
 */
export declare function createIntakeServer(): http.Server;
//# sourceMappingURL=api.d.ts.map