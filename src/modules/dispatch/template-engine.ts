// Dispatch module — Handlebars plan template renderer (dispatch-module.md § 4.3)
import Handlebars from "handlebars";
import { readFile } from "../../utils/file-writer.js";

export interface TemplateVars {
  alias: string;
  context: string;
  model: string;
  slug: string;
  started_at: string;
}

/**
 * Render a plan template file with the given variables.
 * Returns the rendered string.
 */
export async function renderTemplate(
  templatePath: string,
  vars: TemplateVars,
): Promise<string> {
  const raw = await readFile(templatePath);
  if (!raw) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  const compiled = Handlebars.compile(raw);
  return compiled(vars);
}
