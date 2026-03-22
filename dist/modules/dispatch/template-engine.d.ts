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
export declare function renderTemplate(templatePath: string, vars: TemplateVars): Promise<string>;
//# sourceMappingURL=template-engine.d.ts.map