import type { DispatchCommand } from "../../types/dispatch.js";
/**
 * Parse a /dispatch command string into a DispatchCommand.
 * Input format: "[alias]: [optional context]" or "[alias]"
 */
export declare function parseDispatchCommand(raw: string): DispatchCommand;
/**
 * Generate a unique task slug for the given command.
 */
export declare function resolveTaskSlug(command: DispatchCommand): Promise<string>;
//# sourceMappingURL=command-parser.d.ts.map