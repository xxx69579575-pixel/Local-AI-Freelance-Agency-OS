export declare class AgencyOSError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class AIParseError extends AgencyOSError {
    readonly attempts: number;
    constructor(message: string, attempts: number);
}
export declare class WaitingForInputError extends AgencyOSError {
    readonly sequence: number;
    constructor(sequence: number);
}
export declare class InvalidAliasError extends AgencyOSError {
    constructor(alias: string, validAliases: string[]);
}
export declare class SpecGateError extends AgencyOSError {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map