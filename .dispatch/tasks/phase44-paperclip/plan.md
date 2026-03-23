# Phase 4.4 — Paperclip Agent 任務治理層整合

- [x] 研究現有 agent_logs schema 與 services/dev-dispatcher、revision-manager 的任務流程 — agent_logs 用於操作日誌；tasks 表為新增的 Paperclip 任務治理表
- [x] 設計 Paperclip 整合方案：定義 task lifecycle（created → dispatched → running → completed/failed）及 governance hooks
- [x] 實作 services/paperclip/server.js：task registry（POST /task, GET /task/:id, PATCH /task/:id/status, GET /tasks）
- [x] 讓 dev-dispatcher 與 revision-manager 在關鍵節點呼叫 Paperclip API 記錄任務狀態
- [x] 新增後端 GET /api/task-governance、PATCH /cancel、POST /retry 端點
- [x] 新增前端 TaskGovernancePanel：services/dashboard/public/task-governance.html — 任務列表、狀態計數、cancel/retry
- [x] 整合至 dashboard — kanban.html 加入「任務治理」nav link + 即時 badge（running 數量）
- [x] 寫入摘要至 .dispatch/tasks/phase44-paperclip/output.md
