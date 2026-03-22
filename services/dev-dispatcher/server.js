'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');
const { generateTaskInstruction } = require('./task-template');
const { runClaudeTask } = require('./claude-runner');

const PORT = process.env.PORT || 3006;
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || '/projects';
const PAPERCLIP_URL = process.env.PAPERCLIP_URL || 'http://paperclip:3008';

// ---------------------------------------------------------------------------
// Paperclip helpers — fire-and-forget; errors are logged but never thrown
// ---------------------------------------------------------------------------
function paperclipRequest(method, urlPath, body) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, PAPERCLIP_URL);
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
    req.on('error', (e) => {
      console.warn(`[paperclip] ${method} ${urlPath} error: ${e.message}`);
      resolve(null);
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function paperclipCreateTask(projectId, agentName, action, payload) {
  const result = await paperclipRequest('POST', '/task', {
    project_id: projectId,
    agent_name: agentName,
    action,
    payload,
  });
  return result && result.statusCode === 201 ? result.body.id : null;
}

async function paperclipUpdateStatus(taskId, status) {
  if (!taskId) return;
  await paperclipRequest('PATCH', `/task/${taskId}/status`, { status });
}

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

    // 4b. Register task in Paperclip (fire-and-forget; non-blocking)
    const paperclipTaskId = await paperclipCreateTask(project.id, 'claude-code', 'dispatch', {
      task_file: taskFilePath,
      dispatched_at: dispatchedAt,
    });
    if (paperclipTaskId) {
      await paperclipUpdateStatus(paperclipTaskId, 'dispatched');
    }

    // 5. Respond
    res.json({
      dispatched: true,
      project_id: project.id,
      task_file: taskFilePath,
      dispatched_at: dispatchedAt,
      paperclip_task_id: paperclipTaskId,
      note: 'Claude runner started asynchronously.',
    });

    // 6. Async: spawn claude --print against the task file
    setImmediate(() => runClaudeTask(workspacePath, project.id, paperclipTaskId));
    return;
  } catch (err) {
    console.error('[dispatch] error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// GET /status/:project_id
// Returns the latest agent_log entry for the project
// ---------------------------------------------------------------------------
app.get('/status/:project_id', async (req, res) => {
  const id = Number(req.params.project_id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'project_id must be a positive integer' });
  }

  try {
    // Verify project exists
    const { rows: projectRows } = await pool.query(
      'SELECT id FROM projects WHERE id = $1',
      [id]
    );
    if (projectRows.length === 0) {
      return res.status(404).json({ error: `Project ${id} not found` });
    }

    const { rows } = await pool.query(
      `SELECT id, agent_name, action, status, input_summary, output_summary, metadata, created_at
       FROM agent_logs
       WHERE entity_type = 'project' AND entity_id = $1 AND agent_name = 'claude-code'
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.json({ project_id: id, log: null, message: 'No dispatch logs found for this project' });
    }

    return res.json({ project_id: id, log: rows[0] });
  } catch (err) {
    console.error('[status] error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /complete
// Body: { project_id, summary }
//
// 1. Verify project exists
// 2. Insert agent_logs record (agent=claude-code, action=complete, status=success)
// 3. Update projects.status → 'pending_review' (待初審)
// 4. Insert kanban_status change record
// 5. Return { completed: true }
// ---------------------------------------------------------------------------
app.post('/complete', async (req, res) => {
  const { project_id, summary } = req.body;

  if (!project_id || !Number.isInteger(Number(project_id))) {
    return res.status(400).json({ error: 'project_id (integer) is required' });
  }
  if (!summary || typeof summary !== 'string' || summary.trim() === '') {
    return res.status(400).json({ error: 'summary (non-empty string) is required' });
  }

  const id = Number(project_id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch project (need current status for kanban log)
    const { rows } = await client.query(
      'SELECT id, status FROM projects WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Project ${id} not found` });
    }

    const prevStatus = rows[0].status;
    const completedAt = new Date().toISOString();

    // 2. Insert agent_logs (completed)
    await client.query(
      `INSERT INTO agent_logs
         (agent_name, action, entity_type, entity_id, status, input_summary, output_summary, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'claude-code',
        'complete',
        'project',
        id,
        'success',
        `project_id=${id}`,
        summary.trim(),
        JSON.stringify({ completed_at: completedAt }),
      ]
    );

    // 3. Update projects.status → pending_review (待初審)
    await client.query(
      `UPDATE projects SET status = 'pending_review', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // 4. Insert kanban_status change record
    await client.query(
      `INSERT INTO kanban_status (entity_type, entity_id, from_status, to_status, triggered_by, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'project',
        id,
        prevStatus,
        'pending_review',
        'webhook',
        `Agent reported completion: ${summary.trim().slice(0, 200)}`,
      ]
    );

    await client.query('COMMIT');

    // Update the most recent running/dispatched Paperclip task for this project
    const pcRes = await paperclipRequest(
      'GET',
      `/tasks?project_id=${id}&status=running`
    );
    if (pcRes && pcRes.body && pcRes.body.tasks && pcRes.body.tasks.length > 0) {
      await paperclipUpdateStatus(pcRes.body.tasks[0].id, 'completed');
    } else {
      // Try dispatched (claude never reported running)
      const pcRes2 = await paperclipRequest(
        'GET',
        `/tasks?project_id=${id}&status=dispatched`
      );
      if (pcRes2 && pcRes2.body && pcRes2.body.tasks && pcRes2.body.tasks.length > 0) {
        await paperclipUpdateStatus(pcRes2.body.tasks[0].id, 'completed');
      }
    }

    return res.json({
      completed: true,
      project_id: id,
      new_status: 'pending_review',
      completed_at: completedAt,
      note: 'Project moved to pending_review (待初審). Human review required before delivery.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[complete] error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[dev-dispatcher] listening on port ${PORT}`);
  console.log(`[dev-dispatcher] projects root: ${PROJECTS_ROOT}`);
});
