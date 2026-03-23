# Phase 3.1 — Dev Agent Dispatcher 完善 · 完成摘要

## 修改檔案

`services/dev-dispatcher/server.js`

## 端點實作狀態

### POST /dispatch（已存在，確認完整）
- 查 projects 表 → 讀 `{workspace}/.dispatch/task.md`（若無 brief.md 回 422）
- 呼叫 `generateTaskInstruction()` 產生 task file
- 寫入 `{workspace}/.dispatch/task.md`
- INSERT agent_logs: `agent_name=claude-code, action=dispatch, status=success`
- 非同步呼叫 `runClaudeTask()` 啟動 claude CLI
- 回傳 `{ dispatched: true, task_file, dispatched_at }`

### GET /status/:project_id（已修正）
- 新增 404 check（project 不存在時回 404）
- LIMIT 改為 **1**（只取最新一筆）
- 回傳格式改為 `{ project_id, log }` 而非 `{ project_id, logs[] }`
- 無紀錄時回 `{ log: null, message }`

### POST /complete（新增）
- 驗證 `project_id`（integer）與 `summary`（non-empty string）
- Transaction（BEGIN / COMMIT / ROLLBACK on error）：
  1. SELECT project 取得 prevStatus（如找不到 → ROLLBACK + 404）
  2. INSERT agent_logs: `action=complete, status=success, output_summary=summary`
  3. UPDATE projects.status = `'pending_review'`（待初審）
  4. INSERT kanban_status: `from=prevStatus, to=pending_review, triggered_by=webhook`
- 回傳 `{ completed: true, project_id, new_status, completed_at }`

## Schema 注意事項

- `agent_logs.status` CHECK 只允許 `started|success|failed|skipped`；
  「dispatched」/「completed」概念以 `action` 欄位（`dispatch` / `complete`）區分。
- `projects.status` CHECK 允許值包含 `pending_review`，對應規格中的「待初審」。
- `kanban_status` 表有 `entity_type='project'` 路徑，trigger 只在 leads 表觸發，
  projects 需手動 INSERT（已在 /complete 中處理）。
