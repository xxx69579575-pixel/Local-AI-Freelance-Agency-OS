'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3003;
const PAPERCLIP_URL = process.env.PAPERCLIP_URL || 'http://paperclip:3008';
const DEV_DISPATCHER_URL = process.env.DEV_DISPATCHER_URL || 'http://dev-dispatcher:3006';
const KNOWLEDGE_BASE_URL = process.env.KNOWLEDGE_BASE_URL || 'http://knowledge-base:3010';

// ---------------------------------------------------------------------------
// Generic HTTP helper for internal service calls
// ---------------------------------------------------------------------------
function serviceRequest(method, baseUrl, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ statusCode: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const ALL_STATUSES = [
  'new',
  'scoring',
  'pending_decision',
  'rejected',
  'pending_quote',
  'quoted',
  'negotiating',
  'negotiation_abandoned',
  'won',
  'in_development',
  'pending_review',
  'in_revision',
  'pending_final',
  'closed',
];

// Agent health check definitions
const AGENTS = [
  { name: 'n8n',              url: 'http://n8n:5678/healthz' },
  { name: 'ollama',           url: 'http://ollama:11434/api/tags' },
  { name: 'telegram-bot',     url: 'http://telegram-bot:3002/health' },
  { name: 'dev-dispatcher',   url: 'http://dev-dispatcher:3006/health' },
  { name: 'revision-manager', url: 'http://revision-manager:3007/health' },
  { name: 'paperclip',        url: 'http://paperclip:3008/health' },
];

function pingService(name, url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(url, { timeout: 3000 }, (res) => {
      res.resume();
      const latency = Date.now() - start;
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 'online' : 'error';
      resolve({ name, status, latency, http_code: res.statusCode });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ name, status: 'offline', latency: 3000 });
    });
    req.on('error', () => {
      resolve({ name, status: 'offline', latency: Date.now() - start });
    });
  });
}

// GET /api/agent-status — parallel health check for all agents
app.get('/api/agent-status', async (req, res) => {
  const results = await Promise.allSettled(
    AGENTS.map(({ name, url }) => pingService(name, url))
  );
  const agents = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { name: AGENTS[i].name, status: 'error', latency: null }
  );
  res.json({ agents, checked_at: new Date().toISOString() });
});

// GET /api/kpi — aggregate KPI statistics
app.get('/api/kpi', async (req, res) => {
  try {
    const [newLeads, aiRec, quotes, projects] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*) FROM leads WHERE fit_score >= 7`),
      pool.query(`SELECT COUNT(*) FROM quotations WHERE created_at >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*) FROM projects WHERE status NOT IN ('cancelled')`),
    ]);

    const quotedCount   = parseInt(quotes.rows[0].count, 10);
    const projectsCount = parseInt(projects.rows[0].count, 10);
    const conversionRate = quotedCount > 0
      ? Math.round((projectsCount / quotedCount) * 100)
      : 0;

    res.json({
      new_leads:       parseInt(newLeads.rows[0].count, 10),
      ai_recommended:  parseInt(aiRec.rows[0].count, 10),
      quotes_sent:     quotedCount,
      deals_won:       projectsCount,
      conversion_rate: conversionRate,
    });
  } catch (err) {
    console.error('GET /api/kpi error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kanban — all statuses with counts and lead lists
app.get('/api/kanban', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        title,
        source,
        status,
        risk_score,
        fit_score,
        expected_profit_score AS profit_score,
        scraped_at
      FROM leads
      ORDER BY scraped_at DESC
    `);

    const result = {};
    for (const status of ALL_STATUSES) {
      result[status] = { count: 0, leads: [] };
    }

    for (const row of rows) {
      const bucket = result[row.status];
      if (bucket) {
        bucket.leads.push(row);
        bucket.count++;
      }
    }

    res.json(result);
  } catch (err) {
    console.error('GET /api/kanban error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kanban/:status — leads for a single status
app.get('/api/kanban/:status', async (req, res) => {
  const { status } = req.params;
  if (!ALL_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Unknown status: ${status}` });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
        id,
        title,
        source,
        status,
        risk_score,
        fit_score,
        expected_profit_score AS profit_score,
        scraped_at
      FROM leads
      WHERE status = $1
      ORDER BY scraped_at DESC`,
      [status]
    );

    res.json({ status, count: rows.length, leads: rows });
  } catch (err) {
    console.error(`GET /api/kanban/${status} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Approval Queue ───────────────────────────────────────────────────────────

// GET /api/approval-queue — all items awaiting human approval, sorted by priority:
//   1. quotations (pending approval)  2. project reviews  3. dispatched agent logs
app.get('/api/approval-queue', async (req, res) => {
  try {
    const [quotRows, projRows, agentRows] = await Promise.all([
      // quotations not yet approved (approved_at IS NULL)
      pool.query(`
        SELECT
          q.id,
          q.lead_id,
          l.title AS lead_title,
          l.source,
          q.draft_content,
          q.generated_at,
          q.created_at
        FROM quotations q
        JOIN leads l ON l.id = q.lead_id
        WHERE q.approved_at IS NULL
        ORDER BY q.created_at ASC
      `),
      // projects pending human review
      pool.query(`
        SELECT
          p.id,
          p.title,
          p.client_name,
          p.status,
          p.due_date,
          p.updated_at
        FROM projects p
        WHERE p.status = 'pending_review'
        ORDER BY p.updated_at ASC
      `),
      // agent dispatch logs awaiting acknowledgement
      pool.query(`
        SELECT
          al.id,
          al.agent_name,
          al.action,
          al.entity_type,
          al.entity_id,
          al.output_summary,
          al.created_at
        FROM agent_logs al
        WHERE al.action = 'dispatch' AND al.status = 'success'
        ORDER BY al.created_at DESC
        LIMIT 20
      `),
    ]);

    const items = [
      ...quotRows.rows.map(r => ({ type: 'quotation',       priority: 1, ...r })),
      ...projRows.rows.map(r => ({ type: 'project_review',  priority: 2, ...r })),
      ...agentRows.rows.map(r => ({ type: 'agent_dispatch', priority: 3, ...r })),
    ];

    res.json({ count: items.length, items });
  } catch (err) {
    console.error('GET /api/approval-queue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/quotations/:id/approve — approve quotation, update lead → quoted
app.patch('/api/quotations/:id/approve', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE quotations
         SET approved_at = NOW(), approved_by = 'human', updated_at = NOW()
       WHERE id = $1
       RETURNING id, lead_id, approved_at`,
      [id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quotation not found' });
    }

    await client.query(
      `UPDATE leads SET status = 'quoted', status_updated_at = NOW()
       WHERE id = $1 AND status = 'pending_quote'`,
      [rows[0].lead_id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, quotation: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH /api/quotations/:id/approve error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/quotations/:id/reject — reject quotation draft, trigger revision signal
app.patch('/api/quotations/:id/reject', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { note } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  try {
    const { rows } = await pool.query(
      `SELECT id, lead_id FROM quotations WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Quotation not found' });

    // Log rejection as agent event so revision-manager can pick it up
    await pool.query(
      `INSERT INTO agent_logs (agent_name, action, entity_type, entity_id, status, input_summary)
       VALUES ('dashboard', 'quotation_rejected', 'quotation', $1, 'success', $2)`,
      [id, note || null]
    );

    res.json({ ok: true, quotation_id: id, lead_id: rows[0].lead_id });
  } catch (err) {
    console.error('PATCH /api/quotations/:id/reject error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id/review — approve project review → in_development
app.patch('/api/projects/:id/review', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE projects
         SET status = 'in_development', updated_at = NOW()
       WHERE id = $1 AND status = 'pending_review'
       RETURNING id, lead_id, status`,
      [id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found or not in pending_review' });
    }

    await client.query(
      `UPDATE leads SET status = 'in_development', status_updated_at = NOW()
       WHERE id = $1`,
      [rows[0].lead_id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, project: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH /api/projects/:id/review error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/projects/:id/reject — reject project review → in_revision + create revision record
app.patch('/api/projects/:id/reject', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { feedback } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: projRows } = await client.query(
      `UPDATE projects
         SET status = 'in_revision', updated_at = NOW()
       WHERE id = $1 AND status = 'pending_review'
       RETURNING id, lead_id`,
      [id]
    );
    if (!projRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found or not in pending_review' });
    }

    await client.query(
      `UPDATE leads SET status = 'in_revision', status_updated_at = NOW()
       WHERE id = $1`,
      [projRows[0].lead_id]
    );

    // Get next revision number
    const { rows: revNum } = await client.query(
      `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_num
       FROM revisions WHERE project_id = $1`,
      [id]
    );
    const nextNum = revNum[0].next_num;

    const { rows: revRows } = await client.query(
      `INSERT INTO revisions (project_id, revision_number, client_feedback, status, assigned_to)
       VALUES ($1, $2, $3, 'pending', 'human')
       RETURNING id, revision_number`,
      [id, nextNum, feedback || null]
    );

    await client.query('COMMIT');
    res.json({ ok: true, project_id: id, revision: revRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH /api/projects/:id/reject error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── SLA Status ───────────────────────────────────────────────────────────────

// GET /api/sla-status — projects expiring within 48 h and already overdue
app.get('/api/sla-status', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        title,
        client_name,
        status,
        due_date,
        sla_hours,
        version,
        updated_at,
        EXTRACT(EPOCH FROM (due_date - NOW())) / 3600 AS hours_remaining
      FROM projects
      WHERE due_date IS NOT NULL
        AND status NOT IN ('closed', 'cancelled')
      ORDER BY due_date ASC
    `);

    const overdue  = rows.filter(r => r.hours_remaining <= 0);
    const warning  = rows.filter(r => r.hours_remaining > 0 && r.hours_remaining < 48);

    res.json({
      overdue_count: overdue.length,
      warning_count: warning.length,
      overdue,
      warning,
      overdue_ids: overdue.map(r => r.id),
      warning_ids: warning.map(r => r.id),
    });
  } catch (err) {
    console.error('GET /api/sla-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Task Governance (Paperclip proxy) ───────────────────────────────────────

// GET /api/task-governance — proxy to Paperclip GET /tasks
// Optional query params: status, project_id
app.get('/api/task-governance', async (req, res) => {
  const params = new URLSearchParams();
  if (req.query.status)     params.set('status',     req.query.status);
  if (req.query.project_id) params.set('project_id', req.query.project_id);

  const urlPath = `/tasks${params.toString() ? '?' + params.toString() : ''}`;

  try {
    const result = await serviceRequest('GET', PAPERCLIP_URL, urlPath);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('GET /api/task-governance error:', err.message);
    res.status(502).json({ error: 'Paperclip unavailable', detail: err.message });
  }
});

// PATCH /api/task-governance/:id/cancel — cancel a task via Paperclip
app.patch('/api/task-governance/:id/cancel', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ error: 'Invalid task id' });

  try {
    const result = await serviceRequest(
      'PATCH', PAPERCLIP_URL, `/task/${id}/status`, { status: 'cancelled' }
    );
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(`PATCH /api/task-governance/${id}/cancel error:`, err.message);
    res.status(502).json({ error: 'Paperclip unavailable', detail: err.message });
  }
});

// POST /api/task-governance/:id/retry
// Fetches task from Paperclip to get project_id, then re-dispatches via dev-dispatcher
app.post('/api/task-governance/:id/retry', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ error: 'Invalid task id' });

  try {
    // 1. Get the task from Paperclip
    const taskResult = await serviceRequest('GET', PAPERCLIP_URL, `/task/${id}`);
    if (taskResult.statusCode === 404) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    if (taskResult.statusCode !== 200) {
      return res.status(502).json({ error: 'Paperclip error', detail: taskResult.body });
    }

    const task = taskResult.body;
    if (!task.project_id) {
      return res.status(422).json({ error: 'Task has no project_id; cannot retry' });
    }

    // 2. Re-dispatch via dev-dispatcher
    const dispatchResult = await serviceRequest(
      'POST', DEV_DISPATCHER_URL, '/dispatch', { project_id: task.project_id }
    );

    res.status(dispatchResult.statusCode).json({
      retried: dispatchResult.statusCode < 300,
      original_task_id: id,
      dispatch: dispatchResult.body,
    });
  } catch (err) {
    console.error(`POST /api/task-governance/${id}/retry error:`, err.message);
    res.status(502).json({ error: 'Service unavailable', detail: err.message });
  }
});

// GET /api/cost-summary — aggregate token usage and cost from cost_logs
app.get('/api/cost-summary', async (req, res) => {
  try {
    const [totals, byService, byDay] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(prompt_tokens + completion_tokens), 0)::BIGINT AS total_tokens,
          COALESCE(SUM(cost_usd), 0)                                   AS total_cost_usd
        FROM cost_logs
      `),
      pool.query(`
        SELECT
          service,
          COALESCE(SUM(prompt_tokens + completion_tokens), 0)::BIGINT AS tokens,
          COALESCE(SUM(cost_usd), 0)                                   AS cost_usd
        FROM cost_logs
        GROUP BY service
        ORDER BY tokens DESC
      `),
      pool.query(`
        SELECT
          DATE(created_at AT TIME ZONE 'UTC') AS day,
          COALESCE(SUM(prompt_tokens + completion_tokens), 0)::BIGINT AS tokens,
          COALESCE(SUM(cost_usd), 0)                                   AS cost_usd
        FROM cost_logs
        GROUP BY day
        ORDER BY day DESC
        LIMIT 30
      `),
    ]);

    res.json({
      total_tokens:   parseInt(totals.rows[0].total_tokens,  10),
      total_cost_usd: parseFloat(totals.rows[0].total_cost_usd),
      by_service: byService.rows.map(r => ({
        service:  r.service,
        tokens:   parseInt(r.tokens,   10),
        cost_usd: parseFloat(r.cost_usd),
      })),
      by_day: byDay.rows.map(r => ({
        day:      r.day,
        tokens:   parseInt(r.tokens,   10),
        cost_usd: parseFloat(r.cost_usd),
      })),
    });
  } catch (err) {
    console.error('GET /api/cost-summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Knowledge Base proxy ─────────────────────────────────────────────────────

// GET /api/knowledge — proxy to knowledge-base GET /knowledge
app.get('/api/knowledge', async (req, res) => {
  const params = new URLSearchParams();
  if (req.query.outcome) params.set('outcome', req.query.outcome);
  if (req.query.tags)    params.set('tags',    req.query.tags);
  if (req.query.page)    params.set('page',    req.query.page);
  if (req.query.limit)   params.set('limit',   req.query.limit);

  const urlPath = `/knowledge${params.toString() ? '?' + params.toString() : ''}`;
  try {
    const result = await serviceRequest('GET', KNOWLEDGE_BASE_URL, urlPath);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('GET /api/knowledge error:', err.message);
    res.status(502).json({ error: 'knowledge-base unavailable', detail: err.message });
  }
});

// POST /api/knowledge/learn — proxy to knowledge-base POST /learn
app.post('/api/knowledge/learn', async (req, res) => {
  try {
    const result = await serviceRequest('POST', KNOWLEDGE_BASE_URL, '/learn', req.body);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('POST /api/knowledge/learn error:', err.message);
    res.status(502).json({ error: 'knowledge-base unavailable', detail: err.message });
  }
});

// ─── Static files ─────────────────────────────────────────────────────────────

// GET / — serve kanban.html
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kanban.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'dashboard', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[dashboard] listening on port ${PORT}`);
});
