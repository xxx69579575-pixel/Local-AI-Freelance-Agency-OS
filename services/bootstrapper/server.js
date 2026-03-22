'use strict';

require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const fse = require('fs-extra');
const path = require('path');
const {
  generateReadme,
  generateBrief,
  generateScope,
  generateTodo,
  generateClientLog,
} = require('./templates');

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3005;
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || '/projects';
const KNOWLEDGE_BASE_URL = process.env.KNOWLEDGE_BASE_URL || 'http://knowledge-base:3010';

const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 10,
});

// ─── HTTP helper ──────────────────────────────────────────────────────────────

const http = require('http');

function httpPost(baseUrl, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const payload = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ statusCode: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sanitize a title into a URL-friendly slug.
 * Lowercase, replace non-alphanumeric with hyphens, collapse runs, max 40 chars.
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')       // strip non-word chars (keep spaces & hyphens)
    .replace(/[\s_]+/g, '-')        // spaces/underscores → hyphens
    .replace(/-+/g, '-')            // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')        // trim leading/trailing hyphens
    .slice(0, 40)
    .replace(/-+$/, '');            // trim trailing hyphen after slice
}

/**
 * Log an action to agent_logs table (fire-and-forget, never throws).
 */
async function logAgentAction(client, { action, entityType, entityId, status, durationMs, inputSummary, outputSummary, errorMessage }) {
  try {
    await client.query(
      `INSERT INTO agent_logs
         (agent_name, action, entity_type, entity_id, status, duration_ms, input_summary, output_summary, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      ['bootstrapper', action, entityType, entityId, status, durationMs, inputSummary, outputSummary, errorMessage]
    );
  } catch (_) {
    // logging failure must never break the main flow
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'bootstrapper', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// ── POST /bootstrap ───────────────────────────────────────────────────────────
/**
 * Body: { lead_id: number }
 *
 * Flow:
 *   1. Validate input
 *   2. Fetch lead from DB
 *   3. Check for existing project (idempotency)
 *   4. Compute slug + workspace path
 *   5. Create directory atomically (mkdir in a transaction-like manner)
 *   6. Write 5 doc files
 *   7. INSERT into projects table
 *   8. UPDATE leads.project_id
 *   9. Return { project_id, project_path }
 */
app.post('/bootstrap', async (req, res) => {
  const startedAt = Date.now();
  const { lead_id } = req.body;

  // ── 1. Validate ─────────────────────────────────────────────────────────────
  if (!lead_id || typeof lead_id !== 'number') {
    return res.status(400).json({ error: 'lead_id (number) is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 2. Fetch lead ──────────────────────────────────────────────────────────
    const { rows: leads } = await client.query(
      'SELECT * FROM leads WHERE id = $1',
      [lead_id]
    );
    if (leads.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Lead ${lead_id} not found` });
    }
    const lead = leads[0];

    // ── 3. Idempotency check ───────────────────────────────────────────────────
    if (lead.project_id) {
      const { rows: existing } = await client.query(
        'SELECT id, workspace_path FROM projects WHERE id = $1',
        [lead.project_id]
      );
      if (existing.length > 0) {
        await client.query('ROLLBACK');
        return res.json({
          project_id: existing[0].id,
          project_path: existing[0].workspace_path,
          idempotent: true,
          message: 'Project already exists — returning existing record',
        });
      }
    }

    // Also check by lead_id in projects table (handles partial rollback scenarios)
    const { rows: existingByLead } = await client.query(
      'SELECT id, workspace_path FROM projects WHERE lead_id = $1',
      [lead_id]
    );
    if (existingByLead.length > 0) {
      await client.query('ROLLBACK');
      return res.json({
        project_id: existingByLead[0].id,
        project_path: existingByLead[0].workspace_path,
        idempotent: true,
        message: 'Project already exists for this lead — returning existing record',
      });
    }

    // ── 4. Compute slug + path ─────────────────────────────────────────────────
    // We need the project ID first — use a sequence value to derive the path atomically.
    // Strategy: INSERT project first (without workspace_path), get the ID, then derive path,
    // write files, and UPDATE workspace_path — all inside the same transaction.

    const slug = slugify(lead.title);

    // ── 5. INSERT project (placeholder path) ──────────────────────────────────
    const { rows: inserted } = await client.query(
      `INSERT INTO projects (lead_id, slug, title, client_name, status)
       VALUES ($1, $2, $3, $4, 'won')
       RETURNING id`,
      [lead_id, slug, lead.title, lead.client_name]
    );
    const projectId = inserted[0].id;
    const dirName = `${projectId}-${slug}`;
    const workspacePath = path.join(PROJECTS_ROOT, dirName);

    // ── 6. Create directory + write docs ──────────────────────────────────────
    // If directory creation fails the transaction will be rolled back.
    await fse.ensureDir(workspacePath);

    const docs = {
      'README.md': generateReadme(lead, projectId, slug),
      'brief.md': generateBrief(lead, projectId, slug),
      'scope.md': generateScope(lead, projectId),
      'todo.md': generateTodo(lead, projectId),
      'client-log.md': generateClientLog(lead, projectId),
    };

    await Promise.all(
      Object.entries(docs).map(([filename, content]) =>
        fse.writeFile(path.join(workspacePath, filename), content, 'utf8')
      )
    );

    // ── 7. Update workspace_path in projects ──────────────────────────────────
    await client.query(
      'UPDATE projects SET workspace_path = $1 WHERE id = $2',
      [workspacePath, projectId]
    );

    // ── 8. Update leads.project_id ────────────────────────────────────────────
    await client.query(
      'UPDATE leads SET project_id = $1, status = $2, status_updated_at = NOW() WHERE id = $3',
      [projectId, 'in_development', lead_id]
    );

    await client.query('COMMIT');

    const durationMs = Date.now() - startedAt;

    // Log success (after commit so entity IDs are valid)
    await logAgentAction(client, {
      action: 'bootstrap_project',
      entityType: 'project',
      entityId: projectId,
      status: 'success',
      durationMs,
      inputSummary: `lead_id=${lead_id}`,
      outputSummary: `project_id=${projectId}, path=${workspacePath}`,
    });

    return res.status(201).json({
      project_id: projectId,
      project_path: workspacePath,
      slug,
      lead_id,
      docs_created: Object.keys(docs),
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('[bootstrapper] /bootstrap error:', err);

    await logAgentAction(client, {
      action: 'bootstrap_project',
      entityType: 'lead',
      entityId: lead_id,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      inputSummary: `lead_id=${lead_id}`,
      errorMessage: err.message,
    });

    return res.status(500).json({ error: 'Bootstrap failed', message: err.message });
  } finally {
    client.release();
  }
});

// ── POST /complete ────────────────────────────────────────────────────────────
/**
 * Body: { project_id: number, outcome: 'won'|'lost', key_factors?: string, tags?: string[] }
 *
 * 結案流程：
 *   1. 更新 projects.status → 'completed'
 *   2. 呼叫 knowledge-base POST /learn（記錄學習資料）
 *   3. 更新 leads.status → 'closed'
 */
app.post('/complete', async (req, res) => {
  const startedAt = Date.now();
  const { project_id, outcome, key_factors, tags } = req.body;

  if (!project_id || typeof project_id !== 'number') {
    return res.status(400).json({ error: 'project_id (number) is required' });
  }

  const validOutcomes = ['won', 'lost'];
  if (!outcome || !validOutcomes.includes(outcome)) {
    return res.status(400).json({ error: 'outcome must be "won" or "lost"' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch project
    const { rows: projects } = await client.query(
      'SELECT * FROM projects WHERE id = $1',
      [project_id]
    );
    if (projects.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Project ${project_id} not found` });
    }
    const project = projects[0];

    // Update project status to completed
    await client.query(
      `UPDATE projects SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [project_id]
    );

    // Update lead status to closed
    if (project.lead_id) {
      await client.query(
        `UPDATE leads SET status = 'closed', status_updated_at = NOW() WHERE id = $1`,
        [project.lead_id]
      );
    }

    await client.query('COMMIT');

    // Fetch lead details for knowledge-base
    let lead = null;
    if (project.lead_id) {
      const { rows: leadRows } = await client.query(
        'SELECT * FROM leads WHERE id = $1',
        [project.lead_id]
      );
      if (leadRows.length > 0) lead = leadRows[0];
    }

    // Extract budget from lead if available
    const budgetMin = lead?.budget_min  ?? null;
    const budgetMax = lead?.budget_max  ?? null;
    const techStack = lead?.tech_stack  ?? [];
    const category  = lead?.source      ?? null;

    // Build tags: merge provided tags + tech_stack from lead
    const allTags = [
      ...(Array.isArray(tags) ? tags : []),
      ...(Array.isArray(techStack) ? techStack : []),
    ].filter((t, i, arr) => t && arr.indexOf(t) === i); // unique, non-empty

    // Call knowledge-base /learn (best-effort — never fail the main response)
    let kbResult = null;
    try {
      const kbResp = await httpPost(KNOWLEDGE_BASE_URL, '/learn', {
        project_id,
        category,
        tags:       allTags,
        budget_min: budgetMin,
        budget_max: budgetMax,
        outcome,
        key_factors: key_factors || null,
      });
      kbResult = kbResp.body;
      console.log(`[bootstrapper] /complete — knowledge-base learn id=${kbResult?.id} outcome=${outcome}`);
    } catch (kbErr) {
      console.error('[bootstrapper] knowledge-base /learn failed (non-fatal):', kbErr.message);
    }

    const durationMs = Date.now() - startedAt;

    await logAgentAction(client, {
      action:        'complete_project',
      entityType:    'project',
      entityId:      project_id,
      status:        'success',
      durationMs,
      inputSummary:  `project_id=${project_id} outcome=${outcome}`,
      outputSummary: `knowledge_base_id=${kbResult?.id ?? 'n/a'}`,
    });

    return res.json({
      project_id,
      status:          'completed',
      outcome,
      knowledge_base:  kbResult,
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bootstrapper] /complete error:', err);

    await logAgentAction(client, {
      action:       'complete_project',
      entityType:   'project',
      entityId:     project_id,
      status:       'failed',
      durationMs:   Date.now() - startedAt,
      inputSummary: `project_id=${project_id}`,
      errorMessage: err.message,
    });

    return res.status(500).json({ error: 'Complete failed', message: err.message });
  } finally {
    client.release();
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[bootstrapper] listening on port ${PORT}`);
  console.log(`[bootstrapper] projects root: ${PROJECTS_ROOT}`);
});
