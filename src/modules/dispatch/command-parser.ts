// Dispatch module — /dispatch command parser (dispatch-module.md § 3.1)
import { getAliasEntry } from "./alias-registry.js";
import { buildDispatchSlug, resolveDispatchSlug } from "../../utils/slug.js";
import { CONFIG } from "../../config.js";
import type { DispatchCommand } from "../../types/dispatch.js";

/**
 * Parse a /dispatch command string into a DispatchCommand.
 * Input format: "[alias]: [optional context]" or "[alias]"
 */
export function parseDispatchCommand(raw: string): DispatchCommand {
  const colonIdx = raw.indexOf(":");
  let alias: string;
  let context: string;

  if (colonIdx === -1) {
    alias = raw.trim();
    context = "";
  } else {
    alias = raw.slice(0, colonIdx).trim();
    context = raw.slice(colonIdx + 1).trim();
  }

  const entry = getAliasEntry(alias);

  return { alias, context, model: entry.model };
}

/**
 * Generate a unique task slug for the given command.
 */
export async function resolveTaskSlug(command: DispatchCommand): Promise<string> {
  const base = buildDispatchSlug(command.alias, command.context);
  return resolveDispatchSlug(base, CONFIG.paths.dispatch);
}
