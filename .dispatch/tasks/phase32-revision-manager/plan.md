# Phase 3.2 — Revision Manager 服務

- [x] 建立 services/revision-manager/ 目錄結構（package.json + Dockerfile + server.js）
- [x] 實作 POST /revision { project_id, feedback }：查 DB 取得專案 workspace_path
- [x] 自動遞增 revision 編號（掃描 revisions/ 目錄取最大 NNN，+1）
- [x] 寫入 projects/{id}-{slug}/revisions/revision-NNN.md（含 feedback 原文 + AI 拆解 action items）
- [x] 寫入 agent_logs（agent=revision-manager, status=revision_created）
- [x] 呼叫 dev-dispatcher POST /dispatch 重新 dispatch 此專案
- [x] 實作 GET /health 端點
- [x] 寫入摘要至 .dispatch/tasks/phase32-revision-manager/output.md
