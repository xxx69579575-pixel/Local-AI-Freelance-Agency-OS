# Phase 4.4 — Paperclip Agent 任務治理層 — 實作摘要

完成時間：2026-03-22

## 新增服務：services/paperclip

| 檔案 | 說明 |
|------|------|
| `services/paperclip/server.js` | Express 微服務（port 3008）。包含 `tasks` 表自動建立（idempotent）、POST /task、GET /task/:id、GET /tasks、PATCH /task/:id/status 端點 |
| `services/paperclip/package.json` | Node 20 + express + pg |
| `services/paperclip/Dockerfile` | node:20-slim，expose 3008 |

## DB 遷移

| 檔案 | 說明 |
|------|------|
| `db/migrations/001_paperclip_tasks.sql` | 新增 `tasks` 表（id, project_id FK→projects, agent_name, action, status CHECK, payload JSONB, created_at, updated_at）+ 3 個 index + updated_at trigger |

> Paperclip server.js 在啟動時會自動執行 `CREATE TABLE IF NOT EXISTS tasks`，不需要手動跑 migration 就能運行。migration 檔案供 DBA 參考與版控。

## 狀態機

```
created → dispatched → running → completed
                    ↘           ↘
                     cancelled   failed
```

所有 `PATCH /task/:id/status` 請求均驗證合法 transition，非法轉換回傳 409。

## dev-dispatcher 整合

`services/dev-dispatcher/server.js`：
- 加入 `PAPERCLIP_URL` env（預設 `http://paperclip:3008`）
- `paperclipCreateTask()` / `paperclipUpdateStatus()` fire-and-forget helpers（錯誤不阻斷主流程）
- `POST /dispatch`：建立 Paperclip task → `dispatched`，task_id 傳入 `runClaudeTask()`
- `POST /complete`：查詢 project 下 running/dispatched task → 更新為 `completed`

`services/dev-dispatcher/claude-runner.js`：
- `runClaudeTask(projectPath, projectId, paperclipTaskId)` 接受 taskId 參數
- spawn child process 後立即 PATCH Paperclip → `running`

## revision-manager 整合

`services/revision-manager/server.js`：
- 加入 `PAPERCLIP_URL` env
- `POST /revision`：寫入 revision 檔案後，建立 Paperclip task（agent=revision-manager, action=revision_created）→ 立即更新為 `dispatched`

## dashboard 後端端點

`services/dashboard/server.js` 新增：
| 端點 | 說明 |
|------|------|
| `GET /api/task-governance` | 代理 Paperclip GET /tasks（可傳 ?status=, ?project_id=）|
| `PATCH /api/task-governance/:id/cancel` | 代理 Paperclip PATCH → cancelled |
| `POST /api/task-governance/:id/retry` | 取得 task.project_id → 呼叫 dev-dispatcher POST /dispatch |

`AGENTS` 陣列新增 `paperclip` health check 項目。

## dashboard 前端

`services/dashboard/public/kanban.html`：
- Header 加入「任務治理」nav link（`/task-governance.html`）
- 新增 `fetchTaskGovernanceBadge()`：每 30 秒更新 running 任務數 badge
- AGENT_LABELS 加入 `paperclip`

`services/dashboard/public/task-governance.html`（新建）：
- 狀態計數 chips（running / dispatched / created / completed / failed / cancelled）
- 篩選 bar（全部 / running / dispatched / failed / completed / cancelled）
- Task 表格（id, agent, action, project, 狀態, 建立時間, 更新時間, 操作）
- Cancel 按鈕（適用 created/dispatched/running 任務）→ PATCH /api/task-governance/:id/cancel
- Retry 按鈕（適用 failed/cancelled 且有 project_id 的任務）→ POST /api/task-governance/:id/retry
- 每 30 秒自動重新整理

## docker-compose.yml

新增服務：
- `paperclip`（port 3008，depends_on postgres）

更新服務（新增環境變數）：
- `dev-dispatcher`：`PAPERCLIP_URL`, depends_on paperclip
- `revision-manager`：新增完整服務定義（原本缺少），含 `PAPERCLIP_URL`
- `dashboard`：`PAPERCLIP_URL`, `DEV_DISPATCHER_URL`

## 驗收標準檢查

- [x] Paperclip 任務生命週期：created → dispatched → running → completed/failed/cancelled
- [x] dev-dispatcher 在 dispatch 時建立任務並追蹤至 completed
- [x] revision-manager 在 revision 建立時登記任務
- [x] Dashboard 可查詢所有任務（篩選 status/project_id）
- [x] Dashboard 可手動 cancel 執行中任務
- [x] Dashboard 可手動 retry 失敗/取消的任務（重新呼叫 dev-dispatcher）
- [x] 所有 Paperclip 呼叫為 fire-and-forget：Paperclip 不可用不影響主服務
