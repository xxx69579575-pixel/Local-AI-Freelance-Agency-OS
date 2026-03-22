'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = parseInt(process.env.PORT || '3009', 10);
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || '/projects';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const app = express();
app.use(express.json());

// ─── Health ────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  let ollamaOk = false;
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    ollamaOk = r.ok;
  } catch (_) {}
  res.json({ status: 'ok', service: 'comm-assistant', ollama: ollamaOk ? 'reachable' : 'unreachable' });
});

// ─── POST /draft-reply ─────────────────────────────────────────────────────
//
// Body: { project_id, client_message }
// Returns: { draft, project_id, project_slug, workspace_path }

app.post('/draft-reply', async (req, res) => {
  const { project_id, client_message } = req.body;

  if (!project_id || !Number.isInteger(Number(project_id))) {
    return res.status(400).json({ error: 'project_id (integer) is required' });
  }
  if (!client_message || typeof client_message !== 'string' || !client_message.trim()) {
    return res.status(400).json({ error: 'client_message (non-empty string) is required' });
  }

  const id = Number(project_id);
  const client = await pool.connect();

  let project;
  try {
    const { rows } = await client.query(
      'SELECT id, slug, title, workspace_path FROM projects WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: `Project ${id} not found` });
    }
    project = rows[0];
  } finally {
    client.release();
  }

  // Build Ollama prompt
  const systemPrompt = `你是一位專業的自由工作者助理，協助起草給客戶的回覆訊息。
回覆應：
- 使用繁體中文，語氣專業但友善
- 直接回應客戶問題或訊息
- 簡潔清楚，不超過 200 字
- 不要包含任何簽名檔或制式結尾
只輸出回覆草稿本文，不要加任何解釋或格式標記。`;

  const userPrompt = `專案名稱：${project.title}
客戶訊息：${client_message.trim()}

請起草一封回覆。`;

  let ollamaRes;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    console.error('[comm-assistant] Ollama request failed:', err.message);
    return res.status(502).json({ error: 'Ollama request failed', detail: err.message });
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text();
    console.error('[comm-assistant] Ollama error:', text);
    return res.status(502).json({ error: 'Ollama returned error', detail: text });
  }

  let ollamaData;
  try {
    ollamaData = await ollamaRes.json();
  } catch {
    return res.status(502).json({ error: 'Failed to parse Ollama response' });
  }

  const draft = (ollamaData?.message?.content || '').trim();
  if (!draft) {
    return res.status(502).json({ error: 'Ollama returned empty draft' });
  }

  const workspacePath = project.workspace_path || `${PROJECTS_ROOT}/${id}-${project.slug}`;

  console.log(`[comm-assistant] Draft generated for project ${id} (${project.slug})`);

  return res.json({
    draft,
    project_id: id,
    project_slug: project.slug,
    workspace_path: workspacePath,
  });
});

// ─── POST /log-reply ───────────────────────────────────────────────────────
//
// Body: { project_id, draft }
// Appends draft to projects/{id}-{slug}/client-log.md

app.post('/log-reply', async (req, res) => {
  const { project_id, draft } = req.body;

  if (!project_id || !Number.isInteger(Number(project_id))) {
    return res.status(400).json({ error: 'project_id (integer) is required' });
  }
  if (!draft || typeof draft !== 'string' || !draft.trim()) {
    return res.status(400).json({ error: 'draft (non-empty string) is required' });
  }

  const id = Number(project_id);
  const client = await pool.connect();

  let project;
  try {
    const { rows } = await client.query(
      'SELECT id, slug, workspace_path FROM projects WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: `Project ${id} not found` });
    }
    project = rows[0];
  } finally {
    client.release();
  }

  const workspacePath = project.workspace_path || `${PROJECTS_ROOT}/${id}-${project.slug}`;
  const logPath = path.join(workspacePath, 'client-log.md');

  // Ensure workspace directory exists
  fs.mkdirSync(workspacePath, { recursive: true });

  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n\n${draft.trim()}\n`;

  // Initialise file with header if it doesn't exist
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `# Client Communication Log — Project ${id}\n`, 'utf8');
  }

  fs.appendFileSync(logPath, entry, 'utf8');

  console.log(`[comm-assistant] Appended reply draft to ${logPath}`);

  return res.json({ logged: true, log_path: logPath, timestamp });
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[comm-assistant] listening on port ${PORT}`);
  console.log(`[comm-assistant] projects root: ${PROJECTS_ROOT}`);
  console.log(`[comm-assistant] ollama: ${OLLAMA_URL} model: ${OLLAMA_MODEL}`);
});
