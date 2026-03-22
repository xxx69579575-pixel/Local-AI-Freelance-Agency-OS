// Dispatch module — Handlebars plan template renderer (dispatch-module.md § 4.3)
import Handlebars from "handlebars";
import { readFile } from "../../utils/file-writer.js";
/**
 * Render a plan template file with the given variables.
 * Returns the rendered string.
 */
export async function renderTemplate(templatePath, vars) {
    const raw = await readFile(templatePath);
    if (!raw) {
        throw new Error(`Template not found: ${templatePath}`);
    }
    const compiled = Handlebars.compile(raw);
    return compiled(vars);
}
//# sourceMappingURL=template-engine.js.map