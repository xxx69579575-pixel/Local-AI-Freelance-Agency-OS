'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3007;
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || '/projects';
const DEV_DISPATCHER_URL = process.env.DEV_DISPATCHER_URL || 'http://dev-dispatcher:3006';
const PAPERCLIP_URL = process.env.PAPERCLIP_URL || 'http://paperclip:3008';

// ---------------------------------------------------------------------------
// Paperclip helper — fire-and-forget
// ---------------------------------------------------------------------------
function paperclipRequest(method, urlPath, body) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, PAPERCLIP_URL);
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(null); }
        });
      }
    );
    req.on('error', (e) => {
      console.warn(`[revision-manager] paperclip ${method} error: ${e.message}`);
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
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
  res.json({ status: 'ok', service: 'revision-manager', ts: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse feedback string into action items.
 * Splits on newlines and sentence-ending periods; filters empty strings.
 */
function parseActionItems(feedback) {
  return feedback
    .split(/\n|(?<=\S)\.\s+/)
    .map((s) => s.replace(/\.$/, '').trim())
    .filter((s) => s.length > 0);
}

/**
 * Scan the revisions/ directory and return the next revision number (zero-padded to 3 digits).
 * If no revisions exist, returns '001'.
 */
function nextRevisionNumber(revisionsDir) {
  if (!fs.existsSync(revisionsDir)) {
    return '001';
  }

  const files = fs.readdirSync(revisionsDir);
  const nums = files
    .map((f) => {
      const m = f.match(/^revision-(\d+)\.md$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1).padStart(3, '0');
}

/**
 * Build the YAML frontmatter revision file content.
 */
function buildRevisionContent({ revisionNum, projectId, createdAt, feedback, actionItems }) {
  const itemLines = actionItems.map((item) => `  - ${item}`).join('\n');
  return `---
revision: ${revisionNum}
project_id: ${projectId}
created_at: ${createdAt}
feedback: |
${feedback
  .split('\n')
  .map((l) => `  ${l}`)
  .join('\n')}
action_items:
${itemLines}
---
`;
}

/**
 * POST to dev-dispatcher /dispatch.
 * Returns a promise resolving to the parsed JSON response body.
 */
function callDevDispatcher(projectId) {
  return new Promise((resolve, reject) => {
    const url = new URL('/dispatch', DEV_DISPATCHER_URL);
    const body = JSON.stringify({ project_id: projectId });

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// POST /revision
// Body: { project_id, feedback }
//
// 1. Fetch project row from DB
// 2. Determine next revision number
// 3. Write projects/{id}-{slug}/revisions/revision-NNN.md
// 4. Insert agent_logs record
// 5. Call dev-dispatcher POST /dispatch
// 6. Return { created: true, revision_file, dispatch_result }
// ---------------------------------------------------------------------------
app.post('/revision', async (req, res) => {
  const { project_id, feedback } = req.body;

  if (!project_id || !Number.isInteger(Number(project_id))) {
    return res.status(400).json({ error: 'project_id (integer) is required' });
  }
  if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
    return res.status(400).json({ error: 'feedback (non-empty string) is required' });
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

    // 2. Determine next revision number
    const revisionsDir = path.join(workspacePath, 'revisions');
    fs.mkdirSync(revisionsDir, { recursive: true });

    const revisionNum = nextRevisionNumber(revisionsDir);

    // 3. Parse feedback → action items & write file
    const actionItems = parseActionItems(feedback.trim());
    const createdAt = new Date().toISOString();
    const revisionContent = buildRevisionContent({
      revisionNum,
      projectId: id,
      createdAt,
      feedback: feedback.trim(),
      actionItems,
    });

    const revisionFileName = `revision-${revisionNum}.md`;
    const revisionFilePath = path.join(revisionsDir, revisionFileName);
    fs.writeFileSync(revisionFilePath, revisionContent, 'utf8');

    // 4. Insert agent_logs
    await client.query(
      `INSERT INTO agent_logs
         (agent_name, action, entity_type, entity_id, status, input_summary, output_summary, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'revision-manager',
        'revision_created',
        'project',
        id,
        'revision_created',
        `feedback: ${feedback.trim().slice(0, 120)}`,
        `revision file written: ${revisionFilePath}`,
        JSON.stringify({
          revision_num: revisionNum,
          revision_file: revisionFilePath,
          action_items_count: actionItems.length,
          created_at: createdAt,
        }),
      ]
    );

    // 4b. Register revision task in Paperclip (fire-and-forget)
    const pcTask = await paperclipRequest('POST', '/task', {
      project_id: id,
      agent_name: 'revision-manager',
      action: 'revision_created',
      payload: {
        revision_num: revisionNum,
        revision_file: revisionFilePath,
        action_items_count: actionItems.length,
      },
    });
    if (pcTask && pcTask.id) {
      // Mark as dispatched immediately (revision file is written, dispatch is next)
      paperclipRequest('PATCH', `/task/${pcTask.id}/status`, { status: 'dispatched' }).catch(() => {});
    }

    // 5. Call dev-dispatcher
    let dispatchResult;
    try {
      dispatchResult = await callDevDispatcher(id);
    } catch (err) {
      dispatchResult = { error: err.message };
    }

    // 6. Respond
    return res.json({
      created: true,
      project_id: id,
      revision_num: revisionNum,
      revision_file: revisionFilePath,
      action_items: actionItems,
      dispatch_result: dispatchResult,
    });
  } catch (err) {
    console.error('[revision] error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[revision-manager] listening on port ${PORT}`);
  console.log(`[revision-manager] projects root: ${PROJECTS_ROOT}`);
  console.log(`[revision-manager] dev-dispatcher: ${DEV_DISPATCHER_URL}`);
});
