// Slug generation utilities (intake-module.md § 3.5, dispatch-module.md § 3.1.1)
import { v4 as uuidv4 } from "uuid";
import { fileExists } from "./file-writer.js";

/**
 * Generate an intake slug from a project name.
 * Rules (intake-module.md § 3.5):
 *  1. Lowercase
 *  2. Remove non-ASCII characters (including CJK)
 *  3. Replace special chars (except space/hyphen) with -
 *  4. Collapse consecutive - and trim
 *  5. If empty after above → "proj-{8 chars of UUID v4}"
 *  6. Collision: append incrementing number (my-project-2, -3, …)
 */
export function buildIntakeSlug(projectName: string): string {
  let slug = projectName.toLowerCase();
  // Remove non-ASCII characters
  slug = slug.replace(/[^\x00-\x7F]/g, "");
  // Replace chars other than alphanumeric, space, hyphen with -
  slug = slug.replace(/[^a-z0-9 -]/g, "-");
  // Replace spaces with -
  slug = slug.replace(/ +/g, "-");
  // Collapse consecutive -
  slug = slug.replace(/-+/g, "-");
  // Trim leading/trailing -
  slug = slug.replace(/^-+|-+$/g, "");

  if (slug.length === 0) {
    slug = `proj-${uuidv4().replace(/-/g, "").slice(0, 8)}`;
  }

  return slug;
}

/**
 * Resolve an intake slug, handling collisions by appending -2, -3, …
 */
export async function resolveIntakeSlug(
  baseSlug: string,
  intakeDir: string,
): Promise<string> {
  const candidatePath = `${intakeDir}/${baseSlug}.md`;
  if (!(await fileExists(candidatePath))) return baseSlug;

  let n = 2;
  while (true) {
    const candidate = `${baseSlug}-${n}`;
    if (!(await fileExists(`${intakeDir}/${candidate}.md`))) return candidate;
    n++;
  }
}

/**
 * Generate a dispatch task slug from alias + context.
 * Rules (dispatch-module.md § 3.1.1):
 *  1. alias stays as-is (already kebab)
 *  2. context → kebab: lowercase, remove non-ASCII, replace special chars with -, collapse
 *  3. If context-kebab non-empty → "{alias}-{context-kebab}"
 *  4. If context-kebab empty → just "{alias}"
 *  5. Collision → append timestamp "{slug}-{YYYYMMDDHHmm}"
 */
export function buildDispatchSlug(alias: string, context: string): string {
  let contextKebab = context.toLowerCase();
  contextKebab = contextKebab.replace(/[^\x00-\x7F]/g, "");
  contextKebab = contextKebab.replace(/[^a-z0-9 -]/g, "-");
  contextKebab = contextKebab.replace(/ +/g, "-");
  contextKebab = contextKebab.replace(/-+/g, "-");
  contextKebab = contextKebab.replace(/^-+|-+$/g, "");

  return contextKebab.length > 0 ? `${alias}-${contextKebab}` : alias;
}

/**
 * Resolve a dispatch task slug, handling collisions by appending a timestamp.
 */
export async function resolveDispatchSlug(
  baseSlug: string,
  tasksDir: string,
): Promise<string> {
  const candidatePath = `${tasksDir}/${baseSlug}`;
  if (!(await fileExists(candidatePath))) return baseSlug;

  const now = new Date();
  const ts =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0");
  return `${baseSlug}-${ts}`;
}
