'use strict';

/**
 * templates.js — Doc file generators for Project Bootstrapper
 * Each function receives a `lead` row (from DB) and returns the file content string.
 */

function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toISOString().slice(0, 10);
}

function formatArray(arr) {
  if (!arr || arr.length === 0) return 'N/A';
  return arr.join(', ');
}

/**
 * README.md — 專案概覽
 */
function generateReadme(lead, projectId, slug) {
  return `# ${lead.title}

> **Project ID**: ${projectId}
> **Slug**: ${slug}
> **Created**: ${formatDate(new Date())}
> **Status**: won

---

## 案件摘要

| 欄位 | 內容 |
|------|------|
| 來源平台 | ${lead.source} |
| 客戶 | ${lead.client_name || 'N/A'} |
| 預算 | ${lead.budget_estimate || lead.budget_raw || 'N/A'} |
| 截止日期 | ${formatDate(lead.deadline) || lead.deadline_raw || 'N/A'} |
| 技術棧 | ${formatArray(lead.tech_stack)} |
| 原始連結 | ${lead.url || 'N/A'} |

## AI 評分

| 指標 | 分數 |
|------|------|
| 風險分數 | ${lead.risk_score}/10 |
| 適合度分數 | ${lead.fit_score}/10 |
| 預期利潤分數 | ${lead.expected_profit_score}/10 |

**建議行動**: ${lead.recommended_action || 'N/A'}

**評分摘要**: ${lead.reason_summary || 'N/A'}

## 目錄

\`\`\`
${projectId}-${slug}/
├── README.md       ← 本文件（專案概覽）
├── brief.md        ← 完整需求 brief（給 Dev Agent）
├── scope.md        ← 交付範圍與不含項目
├── todo.md         ← 初始任務清單
└── client-log.md   ← 客戶溝通日誌
\`\`\`
`;
}

/**
 * brief.md — 完整需求 brief，供 Dev Agent（Claude Code / Codex）使用
 * 必須包含所有 lead 資訊，讓 Claude Code 可以從這份文件獨立工作。
 */
function generateBrief(lead, projectId, slug) {
  const techStack = formatArray(lead.tech_stack);
  return `# Project Brief — ${lead.title}

> **給 Dev Agent 的完整需求文件**
> **Project ID**: ${projectId} | **Slug**: ${slug}
> **Generated**: ${new Date().toISOString()}

---

## 1. 案件基本資訊

| 欄位 | 內容 |
|------|------|
| 案件標題 | ${lead.title} |
| 來源平台 | ${lead.source} |
| 原始連結 | ${lead.url || 'N/A'} |
| 外部 ID | ${lead.external_id || 'N/A'} |
| 客戶名稱 | ${lead.client_name || 'N/A'} |
| 採集時間 | ${formatDate(lead.scraped_at)} |

## 2. 預算與時程

| 欄位 | 內容 |
|------|------|
| 預算（原始） | ${lead.budget_raw || 'N/A'} |
| 預算（AI 解析） | ${lead.budget_estimate || 'N/A'} |
| 截止（原始） | ${lead.deadline_raw || 'N/A'} |
| 截止（解析後） | ${formatDate(lead.deadline)} |

## 3. 技術需求

**技術棧**: ${techStack}

## 4. 案件描述（原文）

${lead.description || '（無描述）'}

## 5. AI 評估

| 指標 | 分數（1–10） |
|------|-------------|
| 風險分數 | ${lead.risk_score ?? 'N/A'} |
| 適合度分數 | ${lead.fit_score ?? 'N/A'} |
| 預期利潤分數 | ${lead.expected_profit_score ?? 'N/A'} |

**建議行動**: ${lead.recommended_action || 'N/A'}

**評分說明**:
${lead.reason_summary || 'N/A'}

**AI 模型**: ${lead.ollama_model || 'N/A'}
**評分時間**: ${formatDate(lead.scored_at)}

---

## 6. Dev Agent 執行說明

1. 閱讀本 brief 了解完整需求
2. 查看 \`scope.md\` 確認交付範圍
3. 執行 \`todo.md\` 中的任務清單
4. 所有 git push 需人工確認後執行
5. 完成後更新 \`todo.md\` 狀態
`;
}

/**
 * scope.md — 工作範圍、交付物清單、不含項目
 */
function generateScope(lead, projectId) {
  const techStack = Array.isArray(lead.tech_stack) && lead.tech_stack.length > 0
    ? lead.tech_stack.map(t => `- ${t}`).join('\n')
    : '- （待確認）';

  return `# Scope of Work — ${lead.title}

> **Project ID**: ${projectId}
> **版本**: v1.0
> **日期**: ${formatDate(new Date())}

---

## 交付物清單

- [ ] 依照 \`brief.md\` 中的需求完成開發
- [ ] 程式碼通過基本測試
- [ ] README / 使用說明文件
- [ ] 部署或交付說明

## 技術棧

${techStack}

## 預算範圍

${lead.budget_estimate || lead.budget_raw || '待確認'}

## 截止日期

${formatDate(lead.deadline) || lead.deadline_raw || '待確認'}

---

## 不含項目（Out of Scope）

- 平台帳號管理或維護
- 持續 hosting / 雲端費用
- 超出原始描述範圍的新功能
- 原始描述未提及的第三方整合

---

## 備註

_人工填寫：與客戶確認後在此記錄最終範圍共識_
`;
}

/**
 * todo.md — 初始任務清單 markdown checklist
 */
function generateTodo(lead, projectId) {
  return `# Todo — ${lead.title}

> **Project ID**: ${projectId}
> **建立時間**: ${formatDate(new Date())}

---

## 初始設定

- [ ] 閱讀 \`brief.md\` 確認需求
- [ ] 閱讀 \`scope.md\` 確認交付範圍
- [ ] 建立開發環境
- [ ] 確認技術棧：${formatArray(lead.tech_stack)}

## 開發任務

- [ ] 分析需求，拆解子任務
- [ ] 實作核心功能
- [ ] 撰寫測試
- [ ] 整合測試
- [ ] 程式碼審查

## 交付準備

- [ ] 撰寫使用說明文件
- [ ] 準備交付包 / 部署說明
- [ ] 人工審核（git push 前確認）
- [ ] 交付給客戶

## 收尾

- [ ] 更新 \`client-log.md\` 記錄交付紀錄
- [ ] 確認客戶驗收
- [ ] 歸檔專案
`;
}

/**
 * client-log.md — 客戶溝通日誌模板
 */
function generateClientLog(lead, projectId) {
  const today = formatDate(new Date());
  return `# Client Log — ${lead.title}

> **Project ID**: ${projectId}
> **客戶**: ${lead.client_name || 'N/A'}
> **建立時間**: ${today}

---

## 溝通紀錄

### ${today} — 專案建立

- 系統自動建立專案工作區
- 案件來源：${lead.source}
- 案件連結：${lead.url || 'N/A'}

---

<!-- 格式：
### YYYY-MM-DD — 事件標題

- 內容摘要
- 決策記錄
- 行動項目

-->
`;
}

module.exports = {
  generateReadme,
  generateBrief,
  generateScope,
  generateTodo,
  generateClientLog,
};
