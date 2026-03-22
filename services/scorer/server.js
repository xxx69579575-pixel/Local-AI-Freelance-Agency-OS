'use strict';

require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { buildScoringPrompt } = require('./prompt');
const { buildQuotationPrompt } = require('./quotation');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const KNOWLEDGE_BASE_URL = process.env.KNOWLEDGE_BASE_URL || 'http://knowledge-base:3010';

// ---------------------------------------------------------------------------
// Fetch similar historical cases from knowledge-base service (best-effort)
// ---------------------------------------------------------------------------
async function fetchSimilarCases(techStack) {
  const tags = Array.isArray(techStack)
    ? techStack
    : typeof techStack === 'string' && techStack
      ? techStack.split(',').map(t => t.trim()).filter(Boolean)
      : [];

  if (tags.length === 0) return [];

  try {
    const resp = await fetch(
      `${KNOWLEDGE_BASE_URL}/suggest?tags=${encodeURIComponent(tags.join(','))}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.suggestions || [];
  } catch {
    // knowledge-base is optional — never fail scoring because of it
    return [];
  }
}

// ---------------------------------------------------------------------------
// DB pool for cost logging (optional — if DB_URL not set, logging is skipped)
// ---------------------------------------------------------------------------
const pool = process.env.DB_URL ? new Pool({ connectionString: process.env.DB_URL }) : null;

/**
 * Fire-and-forget: write a cost_logs row after an Ollama call.
 * ollamaData: the parsed JSON response from /api/chat
 */
function logCost(service, ollamaData) {
  if (!pool) return;
  const promptTokens     = ollamaData?.prompt_eval_count     || 0;
  const completionTokens = ollamaData?.eval_count            || 0;
  pool.query(
    `INSERT INTO cost_logs (service, model, prompt_tokens, completion_tokens, cost_usd)
     VALUES ($1, $2, $3, $4, 0)`,
    [service, OLLAMA_MODEL, promptTokens, completionTokens]
  ).catch((err) => console.error('[scorer] cost_logs insert failed:', err.message));
}

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

  // Fetch similar historical cases (best-effort, does not block on failure)
  const similarCases = await fetchSimilarCases(tech_stack);
  if (similarCases.length > 0) {
    console.log(`[scorer] lead_id=${lead_id} — injecting ${similarCases.length} similar case(s) into prompt`);
  }

  const { system, user } = buildScoringPrompt({ title, description, budget_raw, tech_stack, similarCases });

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
  logCost('scorer', ollamaData);

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
  const { lead_id, title, description, budget_raw, tech_stack, client_name, reason_summary } = req.body;

  if (!lead_id) {
    return res.status(400).json({ error: 'lead_id is required' });
  }

  const { system, user } = buildQuotationPrompt({ title, description, budget_raw, tech_stack, client_name, reason_summary });

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
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    console.error('[scorer] Ollama quotation request failed:', err.message);
    return res.status(502).json({ error: 'Ollama request failed', detail: err.message });
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text();
    console.error('[scorer] Ollama quotation error:', text);
    return res.status(502).json({ error: 'Ollama returned error', detail: text });
  }

  const latency_ms = Date.now() - startMs;

  let ollamaData;
  try {
    ollamaData = await ollamaRes.json();
  } catch (err) {
    return res.status(502).json({ error: 'Failed to parse Ollama response as JSON' });
  }

  logCost('quotation', ollamaData);

  const rawContent = ollamaData?.message?.content || '';

  let draft;
  try {
    draft = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        draft = JSON.parse(match[0]);
      } catch {
        console.error('[scorer] Failed to parse quotation JSON:', rawContent);
        return res.status(502).json({ error: 'Ollama did not return valid JSON', raw: rawContent });
      }
    } else {
      console.error('[scorer] No JSON found in quotation response:', rawContent);
      return res.status(502).json({ error: 'Ollama did not return valid JSON', raw: rawContent });
    }
  }

  console.log(`[scorer] lead_id=${lead_id} quotation generated in ${latency_ms}ms`);

  res.json({
    lead_id,
    subject:           String(draft.subject           || ''),
    body:              String(draft.body              || ''),
    price_estimate:    String(draft.price_estimate    || ''),
    timeline_estimate: String(draft.timeline_estimate || ''),
    notes:             String(draft.notes             || ''),
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
