# Phase 3.1 — Dev Agent Dispatcher 完善

- [x] 讀取並理解現有 services/dev-dispatcher/server.js 與 task-template.js
- [x] 完整實作 POST /dispatch：讀 brief.md → 產生 task instruction → 寫入 .dispatch/task.md → 寫 agent_logs(action=dispatch, status=success)；DB CHECK 只允許 'started'|'success'|'failed'|'skipped'，故用 success + action 欄位區分
- [x] 實作 GET /status/:project_id：查詢 agent_logs 回傳最新一筆（LIMIT 1）+ 404 if project not found
- [x] 實作 POST /complete：接收 { project_id, summary }，寫 agent_logs(action=complete, status=success)，UPDATE projects.status='pending_review'，INSERT kanban_status，用 transaction 確保原子性
- [x] 確認所有端點 error handling 完整（400 validation / 404 project / 422 brief.md missing / 500 DB error / ROLLBACK on complete failure）
- [x] 寫入摘要至 .dispatch/tasks/phase31-dispatcher/output.md
