import type { IncomingMessage, ServerResponse } from "node:http";
/**
 * Handle /api/sdd/* routes.
 * Returns true if the request was handled, false if it should fall through.
 */
export declare function handleSddRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
//# sourceMappingURL=api.d.ts.map