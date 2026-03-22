'use strict';

require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3008;

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// State machine: valid transitions
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS = {
  created:    ['dispatched', 'cancelled'],
  dispatched: ['running', 'cancelled'],
  running:    ['completed', 'failed', 'cancelled'],
  completed:  [],
  failed:     [],
  cancelled:  [],
};

function isValidTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// ---------------------------------------------------------------------------
// Ensure tasks table exists (idempotent bootstrap)
// ---------------------------------------------------------------------------
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER,
      agent_name  TEXT NOT NULL,
      action      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','dispatched','running','completed','failed','cancelled')),
      payload     JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)
  `);
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'paperclip', ts: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// POST /task
// Body: { project_id?, agent_name, action, payload? }
// Creates a task with status='created'
// ---------------------------------------------------------------------------
app.post('/task', async (req, res) => {
  const { project_id, agent_name, action, payload } = req.body;

  if (!agent_name || typeof agent_name !== 'string' || agent_name.trim() === '') {
    return res.status(400).json({ error: 'agent_name (non-empty string) is required' });
  }
  if (!action || typeof action !== 'string' || action.trim() === '') {
    return res.status(400).json({ error: 'action (non-empty string) is required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (project_id, agent_name, action, status, payload)
       VALUES ($1, $2, $3, 'created', $4)
       RETURNING *`,
      [
        project_id ? Number(project_id) : null,
        agent_name.trim(),
        action.trim(),
        payload ? JSON.stringify(payload) : null,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /task] error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /tasks
// Query params: status, project_id
// ---------------------------------------------------------------------------
app.get('/tasks', async (req, res) => {
  const { status, project_id } = req.query;

  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (project_id) {
    params.push(Number(project_id));
    conditions.push(`project_id = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    return res.json({ tasks: rows, count: rows.length });
  } catch (err) {
    console.error('[GET /tasks] error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /task/:id
// ---------------------------------------------------------------------------
app.get('/task/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('[GET /task/:id] error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /task/:id/status
// Body: { status }
// Validates state machine transition, then updates
// ---------------------------------------------------------------------------
app.patch('/task/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }

  const { status } = req.body;
  const VALID_STATUSES = Object.keys(VALID_TRANSITIONS);
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const { rows: existing } = await pool.query(
      'SELECT id, status FROM tasks WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }

    const currentStatus = existing[0].status;

    if (currentStatus === status) {
      return res.json({ id, status, note: 'No change (already in this status)' });
    }

    if (!isValidTransition(currentStatus, status)) {
      return res.status(409).json({
        error: `Invalid transition: ${currentStatus} → ${status}`,
        allowed: VALID_TRANSITIONS[currentStatus],
      });
    }

    const { rows } = await pool.query(
      `UPDATE tasks
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /task/:id/status] error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
ensureTable()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[paperclip] listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[paperclip] failed to ensure table:', err.message);
    process.exit(1);
  });
