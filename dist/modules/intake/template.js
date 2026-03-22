export function buildMarkdown(output, slug) {
    const frontmatter = [
        "---",
        `project_name: "${output.project_name}"`,
        `version: "${output.version}"`,
        `created_at: "${output.created_at}"`,
        `intake_slug: "${slug}"`,
        "---",
    ].join("\n");
    const complexityTable = buildComplexityTable([
        ...output.mvp_features,
        ...output.nice_to_have_features,
    ]);
    return `${frontmatter}

# ${output.project_name} — 客戶需求訪談分析報告

## 一、專案背景摘要

${output.background_summary}

## 二、MVP 功能清單（必要）

${output.mvp_features.map(formatFeature).join("\n\n")}

## 三、Nice-to-Have 功能清單（可選）

${output.nice_to_have_features.length > 0 ? output.nice_to_have_features.map(formatFeature).join("\n\n") : "_無_"}

## 四、技術風險清單

${output.risks.map((r) => `### ${r.id} — ${r.description}\n- **嚴重度**：${r.severity}\n- **緩解策略**：${r.mitigation}`).join("\n\n")}

## 五、功能模組複雜度表

${complexityTable}

## 六、建議實作優先順序

${output.implementation_order.map((id, i) => `${i + 1}. ${id}`).join("\n")}

## 七、下一步行動

| 優先級 | 任務 | Dispatch Alias | 模型 |
|--------|------|---------------|------|
${output.next_actions.map((a) => `| ${a.priority} | ${a.task} | \`${a.dispatch_alias}\` | ${a.model} |`).join("\n")}
`;
}
function formatFeature(f) {
    return `### ${f.id} — ${f.name}\n- **描述**：${f.description}\n- **優先級**：${f.priority}\n- **Phase**：${f.phase}\n- **複雜度**：${f.complexity}`;
}
function buildComplexityTable(features) {
    const header = "| 功能 ID | 功能名稱 | 優先級 | 複雜度 |\n|---------|---------|-------|-------|";
    const rows = features.map((f) => `| ${f.id} | ${f.name} | ${f.priority} | ${f.complexity} |`);
    return [header, ...rows].join("\n");
}
//# sourceMappingURL=template.js.map