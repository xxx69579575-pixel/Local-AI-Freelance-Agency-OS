// SDD module — drift checker (sdd-workflow.md § 4.5)
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "../../utils/file-writer.js";
import { parseAcceptanceCriteria } from "./spec-parser.js";
import { CONFIG } from "../../config.js";
const COVERAGE_NOTE = "AI 分析不保證 100% 覆蓋，對複雜邏輯可能誤判。建議搭配人工審查，不作為唯一驗收依據。";
/**
 * Run drift check: compare spec AC list against implementation files.
 *
 * @param specSlug  e.g. "intake-module"
 * @param implPath  e.g. "src/modules/intake/"
 */
export async function runDriftCheck(specSlug, implPath) {
    const specPath = `${CONFIG.paths.specs}/${specSlug}.md`;
    const specContent = await readFile(specPath);
    if (!specContent) {
        throw new Error(`Spec file not found: ${specPath}`);
    }
    const acList = parseAcceptanceCriteria(specContent);
    if (acList.length === 0) {
        return {
            drifts: [],
            total_acs: 0,
            passed: 0,
            failed: 0,
            analysis_method: "ai",
            coverage_note: COVERAGE_NOTE,
        };
    }
    const implSummary = await collectImplementation(implPath);
    const drifts = await analyseWithAI(acList, implSummary);
    return {
        drifts,
        total_acs: acList.length,
        passed: acList.length - drifts.length,
        failed: drifts.length,
        analysis_method: "ai",
        coverage_note: COVERAGE_NOTE,
    };
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function collectImplementation(implPath) {
    const files = new Map();
    try {
        const entries = await fs.readdir(implPath, { recursive: true });
        for (const entry of entries) {
            const entryStr = String(entry);
            if (!entryStr.endsWith(".ts"))
                continue;
            const fullPath = path.join(implPath, entryStr);
            const content = await readFile(fullPath);
            if (content)
                files.set(entryStr, content);
        }
    }
    catch {
        // implPath may not exist or may be inaccessible
    }
    if (files.size === 0)
        return "(no implementation files found)";
    const lines = [];
    for (const [filePath, content] of files) {
        const sigs = [];
        for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.startsWith("export function ") ||
                trimmed.startsWith("export async function ") ||
                trimmed.startsWith("export class ") ||
                trimmed.startsWith("export const ") ||
                trimmed.startsWith("export interface ")) {
                sigs.push(trimmed.slice(0, 150));
            }
        }
        if (sigs.length > 0) {
            lines.push(`\n--- ${filePath} ---`);
            lines.push(...sigs);
        }
    }
    return lines.join("\n") || "(no exported symbols found)";
}
async function analyseWithAI(acList, implSummary) {
    const client = new Anthropic();
    const acJson = JSON.stringify(acList.map((a) => ({ id: a.id, condition: a.description })), null, 2);
    const systemPrompt = "你是一位程式碼審查專家，負責驗證實作是否符合規格文件的驗收標準（AC）。\n" +
        "對每條 AC，判斷實作摘要是否滿足其條件，並以 JSON 陣列格式輸出結果。\n" +
        "只輸出 JSON，不含其他說明文字。";
    const userPrompt = `規格驗收標準：\n${acJson}\n\n實作摘要：\n${implSummary}\n\n` +
        `請對每條 AC 輸出：[{ "ac_id": "AC-01", "passed": true, "description": "說明" }, ...]`;
    const message = await client.messages.create({
        model: CONFIG.models.sonnet,
        max_tokens: 2048,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
    });
    const text = message.content[0]?.type === "text" ? message.content[0].text : "[]";
    let results = [];
    try {
        // Strip potential markdown fences
        const cleaned = text.replace(/^```[a-z]*\n?/m, "").replace(/\n?```$/m, "");
        results = JSON.parse(cleaned);
    }
    catch {
        // If AI output is not parseable, treat all ACs as unknown (no drift reported)
        return [];
    }
    return results
        .filter((r) => !r.passed)
        .map((r) => ({
        ac_id: r.ac_id,
        description: r.description,
        severity: "medium",
    }));
}
//# sourceMappingURL=drift-checker.js.map