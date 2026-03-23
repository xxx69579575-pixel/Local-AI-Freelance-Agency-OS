# Phase 2.3 + 2.4 — Project Bootstrapper + 專案文件自動產生

- [x] Read `docs/PRD.md` and `db/init.sql` for project bootstrapper spec and projects table schema
- [x] Create `services/bootstrapper/` directory structure
- [x] Write `services/bootstrapper/package.json` — deps: express, pg, dotenv, fs-extra
- [x] Write `services/bootstrapper/Dockerfile` — node:20-slim
- [x] Write `services/bootstrapper/server.js`:
  - POST /bootstrap: accepts { lead_id } → fetches lead from DB → creates /projects/{id}-{slug}/ directory → generates all docs → inserts project record into DB → returns { project_id, project_path }
  - GET /health
- [x] Write `services/bootstrapper/templates.js` — template generators for:
  - README.md: 專案名稱、客戶、技術棧、案件摘要
  - brief.md: 完整需求 brief（給 Dev Agent 使用，含所有 lead 資訊）
  - scope.md: 工作範圍、交付物清單、不含項目
  - todo.md: 初始任務清單 markdown checklist
  - client-log.md: 客戶溝通日誌模板（含日期欄位）
- [x] Update `docker-compose.yml` to add bootstrapper service (port 3005, depends_on postgres, volumes: ./projects:/projects)
- [x] Write summary to `.dispatch/tasks/phase23-24-bootstrapper/output.md`
