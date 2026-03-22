// Shared error classes for Agency OS

export class AgencyOSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AgencyOSError";
  }
}

export class AIParseError extends AgencyOSError {
  constructor(
    message: string,
    public readonly attempts: number,
  ) {
    super(message, "AI_PARSE_ERROR");
    this.name = "AIParseError";
  }
}

export class WaitingForInputError extends AgencyOSError {
  constructor(public readonly sequence: number) {
    super(`Waiting for answer to question #${sequence}`, "WAITING_FOR_INPUT");
    this.name = "WaitingForInputError";
  }
}

export class InvalidAliasError extends AgencyOSError {
  constructor(alias: string, validAliases: string[]) {
    super(
      `Unknown dispatch alias: "${alias}". Valid aliases: ${validAliases.join(", ")}`,
      "INVALID_ALIAS",
    );
    this.name = "InvalidAliasError";
  }
}

export class SpecGateError extends AgencyOSError {
  constructor(message: string) {
    super(message, "SPEC_GATE_FAILED");
    this.name = "SpecGateError";
  }
}
