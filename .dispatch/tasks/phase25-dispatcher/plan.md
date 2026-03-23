# Phase 2.5 — Dev Agent Dispatcher

- [x] Read `docs/PRD.md` for Dev Agent Dispatcher spec
- [x] Read `db/init.sql` for projects table and agent_logs schema
- [x] Create `services/dev-dispatcher/` directory
- [x] Write `services/dev-dispatcher/package.json` — deps: express, pg, dotenv (chokidar not needed per constraint)
- [x] Write `services/dev-dispatcher/Dockerfile` — node:20-slim
- [x] Write `services/dev-dispatcher/server.js`:
  - POST /dispatch: accepts { project_id } → reads /projects/{id}-{slug}/brief.md → writes dispatch task file to /projects/{id}-{slug}/.dispatch/task.md → inserts agent_logs record (agent=claude-code, status=dispatched) → returns { dispatched: true, task_file }
  - GET /status/:project_id → reads agent_logs for latest dispatch status
  - GET /health
- [x] Write `services/dev-dispatcher/task-template.js` — generates the dispatch instruction wrapping brief.md content for Claude Code / Codex consumption
- [x] Update `docker-compose.yml` for dev-dispatcher service (port 3006, depends_on postgres, volumes: ./projects:/projects)
- [x] Write summary to `.dispatch/tasks/phase25-dispatcher/output.md`
