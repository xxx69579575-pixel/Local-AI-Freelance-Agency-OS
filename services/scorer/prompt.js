/**
 * Builds the Ollama scoring prompt for a freelance lead.
 * Forces strict JSON output matching the DB schema fields.
 */

const SYSTEM_PROMPT = `You are an expert freelance project evaluator. You will be given a freelance job lead and must evaluate it.

You MUST respond with ONLY a valid JSON object — no markdown, no explanation, no extra text.

The JSON must have exactly these fields:
{
  "risk_score": <integer 1-10, where 1=very low risk, 10=very high risk>,
  "fit_score": <integer 1-10, where 1=poor fit, 10=perfect fit>,
  "expected_profit_score": <integer 1-10, where 1=very low profit potential, 10=very high profit potential>,
  "recommended_action": <one of: "quote", "skip", "consider">,
  "reason_summary": <string, 1-3 sentences in Traditional Chinese explaining your assessment>,
  "budget_estimate": <string, estimated budget range in TWD or original currency, e.g. "NT$5000-8000">,
  "deadline": <string in ISO date format YYYY-MM-DD if estimable, or null if unknown>
}

Scoring guidelines:
- risk_score: Consider unclear requirements, tight deadlines, low budget, suspicious client descriptions, scope creep potential
- fit_score: Consider tech stack match (React, Node.js, Python, TypeScript are strong fits), project complexity, required skills
- expected_profit_score: Consider budget vs estimated effort, market rate comparison, potential for repeat business
- recommended_action: "quote" if fit>=7 and risk<=5, "skip" if risk>=8 or fit<=3, otherwise "consider"`;

/**
 * @param {object} lead
 * @param {string} lead.title
 * @param {string} lead.description
 * @param {string} lead.budget_raw
 * @param {string[]|string} lead.tech_stack
 * @returns {{ system: string, user: string }}
 */
function buildScoringPrompt(lead) {
  const techStackStr = Array.isArray(lead.tech_stack)
    ? lead.tech_stack.join(', ')
    : (lead.tech_stack || '未指定');

  const userPrompt = `請評估以下接案案件：

案件標題：${lead.title || '（無標題）'}
案件描述：${lead.description || '（無描述）'}
預算：${lead.budget_raw || '（未提供）'}
技術需求：${techStackStr}

請依照規定格式回傳 JSON 評分結果。`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

module.exports = { buildScoringPrompt };
