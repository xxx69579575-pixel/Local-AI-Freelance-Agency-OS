# Phase 3.3 Output

## Files changed

### services/dev-dispatcher/claude-runner.js (new, ~58 lines)
- Reads `{projectPath}/.dispatch/task.md`
- Spawns `claude --print` via child_process, feeds task.md as stdin
- Captures stdout → `{projectPath}/.dispatch/output.md`
- On close, POSTs `{ project_id, summary }` to `http://localhost:3006/complete`

### services/dev-dispatcher/server.js (modified)
- Added `require('./claude-runner')` import
- After writing task.md and responding 200, calls `setImmediate(() => runClaudeTask(workspacePath, project.id))` for non-blocking async execution

## Design notes
- `claude-runner.js` stays under 60 lines (58 lines including blank lines)
- Fire-and-forget via `setImmediate` — response is not blocked
- stderr is logged to console; exit code is recorded in output.md header
- Summary sent to /complete is capped at 300 chars
