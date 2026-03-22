// Intake module — requirement parsing and project_name extraction
import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "../../config.js";
import { AIParseError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { buildIntakeSlug } from "../../utils/slug.js";
import { writeFile } from "../../utils/file-writer.js";
import { validateDispatchAlias } from "../dispatch/alias-registry.js";
import { buildMarkdown } from "./template.js";
import { normalizeFeatures } from "./classifier.js";
import { normalizeRisks } from "./risk-analyzer.js";
const client = new Anthropic();
/**
 * Run the full intake flow:
 *   1. Call AI to analyse requirements (with retry)
 *   2. Normalise and validate the AI output
 *   3. Generate and write the intake document (overwrite if same slug exists — AC-06)
 */
export async function runIntake(input, intakeDir = CONFIG.paths.intake) {
    const output = await analyseRequirements(input);
    // AC-06: same project_name → same slug → overwrite existing file, no collision suffix
    const slug = buildIntakeSlug(output.project_name);
    const outputPath = `${intakeDir}/${slug}.md`;
    const markdown = buildMarkdown(output, slug);
    await writeFile(outputPath, markdown);
    logger.info("Intake document written", { outputPath });
    return { outputPath, output };
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function analyseRequirements(input) {
    const systemPrompt = `你是一位資深 freelance 專案顧問，擅長分析客戶需求並輸出結構化文件。
請根據需求描述，識別核心功能、技術風險，並輸出 JSON 格式的結構化摘要。
輸出必須嚴格符合 IntakeOutput 型別的合法 JSON，不可包含任何額外說明文字或 markdown 代碼塊。`;
    const userPromptBase = `以下是客戶需求描述：
${input.description}

技術限制：${input.tech_constraints?.join(", ") ?? "無"}
截止日期：${input.deadline ?? "未指定"}
預算：${input.budget ?? "未指定"}
專案名稱：${input.project_name}`;
    const retryHints = [
        "",
        "\n\n請確保只輸出合法 JSON，不含 markdown 代碼塊。",
        `\n\n以下為 IntakeOutput 範例，請對照填寫：
{
  "project_name": "my-project",
  "version": "v1.0",
  "created_at": "2026-01-01T00:00:00+08:00",
  "background_summary": "...",
  "mvp_features": [{"id":"M1","name":"...","description":"...","priority":"MVP","phase":"1.1","complexity":"medium"}],
  "nice_to_have_features": [],
  "risks": [{"id":"R1","description":"...","severity":"medium","mitigation":"..."}],
  "implementation_order": ["M1"],
  "next_actions": [{"priority":"P0","task":"...","dispatch_alias":"write-spec","model":"opus"}]
}`,
    ];
    let lastError = null;
    for (let attempt = 0; attempt < CONFIG.ai.totalAttempts; attempt++) {
        try {
            const userPrompt = userPromptBase + retryHints[attempt];
            const message = await client.messages.create({
                model: CONFIG.models.opus,
                max_tokens: 4096,
                messages: [{ role: "user", content: userPrompt }],
                system: systemPrompt,
            });
            const text = message.content[0]?.type === "text" ? message.content[0].text : "";
            const raw = JSON.parse(text);
            // Normalize and validate sub-structures
            const { mvp, niceToHave } = normalizeFeatures(raw.mvp_features, raw.nice_to_have_features);
            const risks = normalizeRisks(raw.risks);
            // Validate dispatch_alias values in next_actions (RV-007)
            const next_actions = (raw.next_actions ?? []).map((a) => ({
                ...a,
                dispatch_alias: validateDispatchAlias(a.dispatch_alias),
            }));
            const output = {
                project_name: raw.project_name || input.project_name,
                version: "v1.0",
                created_at: new Date().toISOString(),
                background_summary: raw.background_summary ?? "",
                mvp_features: mvp,
                nice_to_have_features: niceToHave,
                risks,
                implementation_order: raw.implementation_order ?? [],
                next_actions,
            };
            return output;
        }
        catch (err) {
            lastError = err;
            logger.warn(`AI parse attempt ${attempt + 1} failed`, {
                error: err.message,
            });
        }
    }
    throw new AIParseError(`AI analysis failed after ${CONFIG.ai.totalAttempts} attempts: ${lastError?.message}`, CONFIG.ai.totalAttempts);
}
//# sourceMappingURL=parser.js.map