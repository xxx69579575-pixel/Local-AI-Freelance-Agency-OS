'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PAPERCLIP_URL = process.env.PAPERCLIP_URL || 'http://paperclip:3008';

function paperclipPatchStatus(taskId, status) {
  if (!taskId) return;
  const body = JSON.stringify({ status });
  const url = new URL(`/task/${taskId}/status`, PAPERCLIP_URL);
  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    () => {}
  );
  req.on('error', (e) => console.warn(`[claude-runner] paperclip PATCH error: ${e.message}`));
  req.write(body);
  req.end();
}

/**
 * Run `claude --print` with the contents of {projectPath}/.dispatch/task.md as prompt.
 * Captures stdout → {projectPath}/.dispatch/output.md
 * Reports completion via POST http://localhost:3006/complete
 *
 * @param {string} projectPath  absolute path to the project workspace
 * @param {number} projectId    DB project id
 */
function runClaudeTask(projectPath, projectId, paperclipTaskId) {
  const taskFile = path.join(projectPath, '.dispatch', 'task.md');
  const outputFile = path.join(projectPath, '.dispatch', 'output.md');

  let prompt;
  try {
    prompt = fs.readFileSync(taskFile, 'utf8');
  } catch (err) {
    console.error(`[claude-runner] cannot read task.md: ${err.message}`);
    return;
  }

  const chunks = [];
  const errChunks = [];

  const child = spawn('claude', ['--print'], {
    env: { ...process.env },
    shell: false,
  });

  paperclipPatchStatus(paperclipTaskId, 'running');

  child.stdin.write(prompt);
  child.stdin.end();

  child.stdout.on('data', (d) => chunks.push(d));
  child.stderr.on('data', (d) => errChunks.push(d));

  child.on('close', (code) => {
    const output = Buffer.concat(chunks).toString('utf8');
    const stderr = Buffer.concat(errChunks).toString('utf8');

    const header = `# Claude Output\n\n_exit code: ${code}_\n\n`;
    fs.writeFileSync(outputFile, header + output, 'utf8');

    if (stderr) {
      console.error(`[claude-runner] stderr (project ${projectId}):\n${stderr}`);
    }

    const summary = output.slice(0, 300).replace(/\n/g, ' ');
    postComplete(projectId, summary);
  });
}

function postComplete(projectId, summary) {
  const body = JSON.stringify({ project_id: projectId, summary });
  const req = http.request(
    { hostname: 'localhost', port: 3006, path: '/complete', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => { console.log(`[claude-runner] /complete → ${res.statusCode}`); }
  );
  req.on('error', (e) => console.error(`[claude-runner] /complete error: ${e.message}`));
  req.write(body);
  req.end();
}

module.exports = { runClaudeTask };
