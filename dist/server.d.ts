import http from "node:http";
export declare function requestHandler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
export declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
//# sourceMappingURL=server.d.ts.map