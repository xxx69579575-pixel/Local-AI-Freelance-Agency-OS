'use strict';

/**
 * Build the system + user prompt for Ollama to generate a structured 報價草稿.
 *
 * @param {Object} lead - { title, description, budget_raw, tech_stack, client_name, reason_summary }
 * @returns {{ system: string, user: string }}
 */
function buildQuotationPrompt({ title, description, budget_raw, tech_stack, client_name, reason_summary }) {
  const techStackStr = Array.isArray(tech_stack) && tech_stack.length > 0
    ? tech_stack.join(', ')
    : '未指定';

  const system = `你是一位專業的台灣自由工作者，擅長撰寫接案報價信。
請根據案件資訊，用繁體中文生成一份結構化報價草稿。

你必須回傳合法的 JSON，格式如下（不要加任何 markdown 標記或解釋）：
{
  "subject": "信件主旨（一行，簡短有力，例如：【報價】XX 系統開發提案）",
  "body": "信件正文，包含：1) 自我介紹 2) 理解客戶需求 3) 解決方案簡述 4) 報價說明 5) 交付流程 6) 聯絡方式",
  "price_estimate": "報價範圍，例如：NT$30,000–45,000",
  "timeline_estimate": "交付時程，例如：2–3 週",
  "notes": "注意事項或補充（可為空字串）"
}`;

  const user = `案件標題：${title || '（無標題）'}
客戶名稱：${client_name || '（未知）'}
案件描述：${description || '（無描述）'}
預算資訊：${budget_raw || '（未提供）'}
技術需求：${techStackStr}
AI 評估摘要：${reason_summary || '（無）'}

請生成報價草稿 JSON：`;

  return { system, user };
}

module.exports = { buildQuotationPrompt };
