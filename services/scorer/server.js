'use strict';

require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const { buildScoringPrompt } = require('./prompt');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const ollamaOk = resp.ok;
    res.json({ status: 'ok', ollama: ollamaOk ? 'reachable' : 'unreachable', model: OLLAMA_MODEL });
  } catch {
    res.json({ status: 'ok', ollama: 'unreachable', model: OLLAMA_MODEL });
  }
});

// ---------------------------------------------------------------------------
// POST /score
// ---------------------------------------------------------------------------
app.post('/score', async (req, res) => {
  const { lead_id, title, description, budget_raw, tech_stack } = req.body;

  if (!lead_id) {
    return res.status(400).json({ error: 'lead_id is required' });
  }

  const { system, user } = buildScoringPrompt({ title, description, budget_raw, tech_stack });

  const startMs = Date.now();

  let ollamaRes;
  try {
    ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    console.error('[scorer] Ollama request failed:', err.message);
    return res.status(502).json({ error: 'Ollama request failed', detail: err.message });
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text();
    console.error('[scorer] Ollama error response:', text);
    return res.status(502).json({ error: 'Ollama returned error', detail: text });
  }

  const latency_ms = Date.now() - startMs;

  let ollamaData;
  try {
    ollamaData = await ollamaRes.json();
  } catch (err) {
    return res.status(502).json({ error: 'Failed to parse Ollama response as JSON' });
  }

  // Ollama /api/chat returns { message: { content: "..." }, ... }
  const rawContent = ollamaData?.message?.content || '';

  let scoring;
  try {
    scoring = JSON.parse(rawContent);
  } catch {
    // Attempt to extract JSON from the response if wrapped in markdown
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        scoring = JSON.parse(match[0]);
      } catch {
        console.error('[scorer] Failed to parse JSON from Ollama content:', rawContent);
        return res.status(502).json({ error: 'Ollama did not return valid JSON', raw: rawContent });
      }
    } else {
      console.error('[scorer] No JSON found in Ollama content:', rawContent);
      return res.status(502).json({ error: 'Ollama did not return valid JSON', raw: rawContent });
    }
  }

  // Clamp scores to 1-10
  const clamp = (v) => Math.min(10, Math.max(1, Math.round(Number(v)) || 5));

  const result = {
    lead_id,
    risk_score: clamp(scoring.risk_score),
    fit_score: clamp(scoring.fit_score),
    expected_profit_score: clamp(scoring.expected_profit_score),
    recommended_action: ['quote', 'skip', 'consider'].includes(scoring.recommended_action)
      ? scoring.recommended_action
      : 'consider',
    reason_summary: String(scoring.reason_summary || ''),
    budget_estimate: scoring.budget_estimate || null,
    deadline: scoring.deadline || null,
    ollama_model: OLLAMA_MODEL,
    latency_ms,
  };

  console.log(`[scorer] lead_id=${lead_id} scored in ${latency_ms}ms — action=${result.recommended_action}`);
  res.json(result);
});

// ---------------------------------------------------------------------------
// POST /quotation
// ---------------------------------------------------------------------------
app.post('/quotation', async (req, res) => {
  const { lead_id, title, description, budget_raw, tech_stack, reason_summary } = req.body;

  if (!lead_id) {
    return res.status(400).json({ error: 'lead_id is required' });
  }

  const techStackStr = Array.isArray(tech_stack)
    ? tech_stack.join(', ')
    : (tech_stack || '未指定');

  const systemPrompt = `你是一位專業的台灣自由工作者，擅長撰寫接案報價信。
請根據案件資訊，用繁體中文寫一封專業的報價信草稿。
信件應包含：自我介紹、理解客戶需求、報價金額範圍、交付時程預估、聯絡方式說明。
只回傳信件內容本身，不要加任何解釋或 markdown 標記。`;

  const userPrompt = `案件標題：${title || '（無標題）'}
案件描述：${description || '（無描述）'}
預算：${budget_raw || '（未提供）'}
技術：${techStackStr}
AI 評估摘要：${reason_summary || '（無）'}

請撰寫報價信草稿：`;

  const startMs = Date.now();

  let ollamaRes;
  try {
    ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Ollama request failed', detail: err.message });
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text();
    return res.status(502).json({ error: 'Ollama returned error', detail: text });
  }

  const latency_ms = Date.now() - startMs;
  const ollamaData = await ollamaRes.json();
  const draft = ollamaData?.message?.content || '';

  res.json({
    lead_id,
    draft,
    ollama_model: OLLAMA_MODEL,
    latency_ms,
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[scorer] ollama-scorer listening on port ${PORT}`);
  console.log(`[scorer] Ollama base URL: ${OLLAMA_BASE_URL}`);
  console.log(`[scorer] Model: ${OLLAMA_MODEL}`);
});
