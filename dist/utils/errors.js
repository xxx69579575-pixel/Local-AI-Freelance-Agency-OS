// Shared error classes for Agency OS
export class AgencyOSError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AgencyOSError";
    }
}
export class AIParseError extends AgencyOSError {
    attempts;
    constructor(message, attempts) {
        super(message, "AI_PARSE_ERROR");
        this.attempts = attempts;
        this.name = "AIParseError";
    }
}
export class WaitingForInputError extends AgencyOSError {
    sequence;
    constructor(sequence) {
        super(`Waiting for answer to question #${sequence}`, "WAITING_FOR_INPUT");
        this.sequence = sequence;
        this.name = "WaitingForInputError";
    }
}
export class InvalidAliasError extends AgencyOSError {
    constructor(alias, validAliases) {
        super(`Unknown dispatch alias: "${alias}". Valid aliases: ${validAliases.join(", ")}`, "INVALID_ALIAS");
        this.name = "InvalidAliasError";
    }
}
export class SpecGateError extends AgencyOSError {
    constructor(message) {
        super(message, "SPEC_GATE_FAILED");
        this.name = "SpecGateError";
    }
}
//# sourceMappingURL=errors.js.map