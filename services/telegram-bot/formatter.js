'use strict';

/**
 * Escape special characters for Telegram MarkdownV2.
 * Per Telegram docs: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
function escMd(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Format a lead record into a Telegram MarkdownV2 notification message.
 * @param {Object} lead — row from the leads table
 * @returns {string} MarkdownV2 formatted message
 */
function formatLeadMessage(lead) {
  const title = escMd(lead.title || '（無標題）');
  const source = escMd(lead.source || '—');
  const budget = escMd(lead.budget_estimate || lead.budget_raw || '—');
  const deadline = escMd(lead.deadline ? String(lead.deadline).slice(0, 10) : '—');
  const techStack = Array.isArray(lead.tech_stack) && lead.tech_stack.length > 0
    ? escMd(lead.tech_stack.join(', '))
    : '—';

  const riskScore = escMd(lead.risk_score != null ? `${lead.risk_score}/10` : '—');
  const fitScore = escMd(lead.fit_score != null ? `${lead.fit_score}/10` : '—');
  const profitScore = escMd(lead.expected_profit_score != null ? `${lead.expected_profit_score}/10` : '—');
  const summary = escMd(lead.reason_summary || '');
  const url = lead.url ? `[案件連結](${lead.url})` : '';

  const lines = [
    `📋 *新案件通知*`,
    ``,
    `📌 *${title}*`,
    `🌐 來源：${source}`,
    `💰 預算：${budget}`,
    `📅 截止：${deadline}`,
    `🛠 技術：${techStack}`,
    ``,
    `📊 *AI 評分*`,
    `⚠️ 風險：${riskScore}`,
    `✅ 適合：${fitScore}`,
    `💵 利潤：${profitScore}`,
  ];

  if (summary) {
    lines.push(``);
    lines.push(`💬 ${summary}`);
  }

  if (url) {
    lines.push(``);
    lines.push(url);
  }

  lines.push(``);
  lines.push(`\\-\\-\\-`);
  lines.push(`請選擇：`);

  return lines.join('\n');
}

/**
 * Build the inline keyboard for a lead notification.
 * @param {number} leadId
 * @returns {Object} Telegram InlineKeyboardMarkup
 */
function buildLeadKeyboard(leadId) {
  return {
    inline_keyboard: [[
      { text: '✅ 聯絡報價', callback_data: `action:quote:${leadId}` },
      { text: '❌ 放棄',    callback_data: `action:reject:${leadId}` },
      { text: '⏰ 稍後處理', callback_data: `action:later:${leadId}` },
    ]],
  };
}

/**
 * Format an AI-generated quote draft for Telegram MarkdownV2 display.
 * @param {Object} draft - { subject, body, price_estimate, timeline_estimate, notes }
 * @param {Object} lead  - { id, title, source }
 * @returns {string} MarkdownV2 formatted message
 */
function formatQuoteDraft(draft, lead) {
  const title    = escMd(lead.title  || '（無標題）');
  const source   = escMd(lead.source || '—');
  const subject  = escMd(draft.subject           || '—');
  const price    = escMd(draft.price_estimate    || '—');
  const timeline = escMd(draft.timeline_estimate || '—');
  const notes    = escMd(draft.notes             || '');

  // body may be long — escape it in full
  const body = escMd(draft.body || '（無草稿）');

  const lines = [
    `✉️ *報價草稿審核*`,
    ``,
    `📌 案件：${title}  \\(${source}\\)`,
    ``,
    `📧 *主旨：*${subject}`,
    `💰 *報價：*${price}`,
    `📅 *時程：*${timeline}`,
    ``,
    `📝 *信件正文：*`,
    body,
  ];

  if (notes) {
    lines.push(``);
    lines.push(`🗒 *備註：*${notes}`);
  }

  lines.push(``);
  lines.push(`\\-\\-\\-`);
  lines.push(`請審核草稿後選擇操作：`);

  return lines.join('\n');
}

/**
 * Build the inline keyboard for a quote draft review.
 * @param {number} leadId
 * @returns {Object} Telegram InlineKeyboardMarkup
 */
function buildQuoteKeyboard(leadId) {
  return {
    inline_keyboard: [[
      { text: '✅ 確認送出', callback_data: `quote:confirm:${leadId}` },
      { text: '✏️ 修改草稿', callback_data: `quote:revise:${leadId}` },
      { text: '❌ 取消',     callback_data: `quote:cancel:${leadId}` },
    ]],
  };
}

module.exports = { escMd, formatLeadMessage, buildLeadKeyboard, formatQuoteDraft, buildQuoteKeyboard };
