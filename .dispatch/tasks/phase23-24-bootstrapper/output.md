# Phase 2.3 + 2.4 — Project Bootstrapper Output

**Completed**: 2026-03-22
**Status**: Done

---

## Files Created

| File | Description |
|------|-------------|
| `services/bootstrapper/package.json` | Dependencies: express, pg, dotenv, fs-extra |
| `services/bootstrapper/Dockerfile` | node:20-slim, port 3005 |
| `services/bootstrapper/server.js` | Express server — POST /bootstrap + GET /health |
| `services/bootstrapper/templates.js` | 5 doc file generators |
| `projects/` | Host-side volume directory (mapped to /projects in container) |

## Files Modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Added `bootstrapper` service (port 3005, volume ./projects:/projects, depends_on postgres) |

---

## API

### POST /bootstrap
**Body**: `{ "lead_id": 123 }`

**Flow**:
1. Validate input
2. Fetch lead from `leads` table
3. Idempotency check — return existing project if already bootstrapped
4. INSERT into `projects` with `slug` = slugified title (max 40 chars)
5. Create `/projects/{id}-{slug}/` directory atomically inside DB transaction
6. Write 5 doc files: `README.md`, `brief.md`, `scope.md`, `todo.md`, `client-log.md`
7. UPDATE `projects.workspace_path`
8. UPDATE `leads.project_id` + set status to `in_development`
9. Log to `agent_logs`

**Response 201**:
```json
{
  "project_id": 1,
  "project_path": "/projects/1-my-project-title",
  "slug": "my-project-title",
  "lead_id": 123,
  "docs_created": ["README.md", "brief.md", "scope.md", "todo.md", "client-log.md"]
}
```

**Idempotent** — repeated calls with same `lead_id` return existing project without re-creating.

### GET /health
Returns `{ status: "ok", service: "bootstrapper", db: "connected" }` when DB is reachable.

---

## Doc Files Generated

| File | Purpose |
|------|---------|
| `README.md` | 專案概覽 — 客戶、預算、技術棧、AI 評分表格 |
| `brief.md` | 完整需求 brief — 給 Dev Agent（含所有 lead 欄位，可獨立工作） |
| `scope.md` | 交付範圍、技術棧、不含項目 |
| `todo.md` | Markdown checklist — 初始設定 → 開發 → 交付 → 收尾 |
| `client-log.md` | 客戶溝通日誌，建立時自動填入初始紀錄 |

---

## Constraints Honoured

- **Idempotent**: checks `leads.project_id` and `projects.lead_id` before creating
- **Atomic**: directory creation + DB inserts happen inside a single DB transaction; if FS write fails, DB is rolled back
- **Slug**: lowercase, hyphens, max 40 chars, leading/trailing hyphens stripped
- **agent_logs**: success and failure both logged
- **Human gate**: no automatic git push or client communication
