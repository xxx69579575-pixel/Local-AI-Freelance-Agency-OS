// Simple structured logger for Agency OS
const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = process.env["LOG_LEVEL"] ?? "info";
function log(level, message, meta) {
    if (LEVELS[level] < LEVELS[currentLevel])
        return;
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.toUpperCase()}]`;
    const line = meta !== undefined ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;
    if (level === "error" || level === "warn") {
        console.error(line);
    }
    else {
        console.log(line);
    }
}
export const logger = {
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
};
//# sourceMappingURL=logger.js.map