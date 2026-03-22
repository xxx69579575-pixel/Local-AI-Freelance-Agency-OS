import type { IncomingMessage, ServerResponse } from "node:http";
/**
 * Handle all /api/dispatch/* requests.
 * Returns true if the request matched a route, false otherwise.
 */
export declare function handleDispatchRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
//# sourceMappingURL=api.d.ts.map