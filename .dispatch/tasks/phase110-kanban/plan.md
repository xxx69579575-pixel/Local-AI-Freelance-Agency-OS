# Phase 1.10 — 基本 Kanban 看板

- [x] Read `db/init.sql` for leads table status values and kanban_status table
- [x] Read `docs/PRD.md` for Kanban status flow (新抓到→AI評估中→待你決策→待報價→已送報價→商談中→已成交→開發中→待初審→待修正→待最終確認→已結案)
- [x] Create `services/dashboard/` directory
- [x] Write `services/dashboard/package.json` — deps: express, pg, dotenv
- [x] Write `services/dashboard/Dockerfile` — node:20-slim
- [x] Write `services/dashboard/server.js`:
  - GET /api/kanban — returns leads grouped by status with counts
  - GET /api/kanban/:status — returns leads list for a given status
  - GET / — serves static kanban.html
- [x] Write `services/dashboard/public/kanban.html` — simple Kanban board: columns per status, lead cards showing title+score+source, auto-refresh every 30s (vanilla JS + CSS, no build step)
- [x] Update `docker-compose.yml` for dashboard service (port 3003, depends_on postgres)
- [x] Write summary to `.dispatch/tasks/phase110-kanban/output.md`
