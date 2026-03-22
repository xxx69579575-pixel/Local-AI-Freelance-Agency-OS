'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { generateTaskInstruction } = require('./task-template');

const PORT = process.env.PORT || 3006;
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || '/projects';

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dev-dispatcher', ts: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// POST /dispatch
// Body: { project_id }
//
// 1. Fetch project row (id, slug, title, workspace_path) from DB
// 2. Read /projects/{id}-{slug}/brief.md
// 3. Write dispatch task file to /projects/{id}-{slug}/.dispatch/task.md
// 4. Insert agent_logs record (agent=claude-code, status=dispatched)
// 5. Return { dispatched: true, task_file }
// ---------------------------------------------------------------------------
app.post('/dispatch', async (req, res) => {
  const { project_id } = req.body;

  if (!project_id || !Number.isInteger(Number(project_id))) {
    return res.status(400).json({ error: 'project_id (integer) is required' });
  }

  const id = Number(project_id);
  const client = await pool.connect();

  try {
    // 1. Fetch project
    const { rows } = await client.query(
      'SELECT id, slug, title, workspace_path FROM projects WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: `Project ${id} not found` });
    }

    const project = rows[0];
    const workspacePath = project.workspace_path || `${PROJECTS_ROOT}/${id}-${project.slug}`;

    // 2. Read brief.md
    const briefPath = path.join(workspacePath, 'brief.md');

    let briefContent;
    try {
      briefContent = fs.readFileSync(briefPath, 'utf8');
    } catch (err) {
      return res.status(422).json({
        error: 'brief.md not found',
        expected_path: briefPath,
      });
    }

    // 3. Write task file
    const dispatchDir = path.join(workspacePath, '.dispatch');
    fs.mkdirSync(dispatchDir, { recursive: true });

    const taskFilePath = path.join(dispatchDir, 'task.md');
    const dispatchedAt = new Date().toISOString();

    const taskContent = generateTaskInstruction({
      projectId: project.id,
      slug: project.slug,
      title: project.title,
      workspacePath,
      briefContent,
      dispatchedAt,
    });

    fs.writeFileSync(taskFilePath, taskContent, 'utf8');

    // 4. Insert agent_logs
    await client.query(
      `INSERT INTO agent_logs
         (agent_name, action, entity_type, entity_id, status, input_summary, output_summary, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'claude-code',
        'dispatch',
        'project',
        project.id,
        'success',
        `brief.md from ${briefPath}`,
        `task file written to ${taskFilePath}`,
        JSON.stringify({ task_file: taskFilePath, dispatched_at: dispatchedAt }),
      ]
    );

    // 5. Respond
    return res.json({
      dispatched: true,
      project_id: project.id,
      task_file: taskFilePath,
      dispatched_at: dispatchedAt,
      note: 'Task file prepared. Run Claude Code against the task file to begin execution.',
    });
  } catch (err) {
    console.error('[dispatch] error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// GET /status/:project_id
// Returns the latest dispatch log for the project
// ---------------------------------------------------------------------------
app.get('/status/:project_id', async (req, res) => {
  const id = Number(req.params.project_id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'project_id must be an integer' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, agent_name, action, status, input_summary, output_summary, metadata, created_at
       FROM agent_logs
       WHERE entity_type = 'project' AND entity_id = $1 AND agent_name = 'claude-code'
       ORDER BY created_at DESC
       LIMIT 10`,
      [id]
    );

    return res.json({ project_id: id, logs: rows });
  } catch (err) {
    console.error('[status] error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[dev-dispatcher] listening on port ${PORT}`);
  console.log(`[dev-dispatcher] projects root: ${PROJECTS_ROOT}`);
});
