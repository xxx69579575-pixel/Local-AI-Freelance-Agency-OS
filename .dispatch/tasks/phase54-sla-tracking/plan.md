# Phase 5.4 — SLA 追蹤與版本管理

- [x] 讀取 DB schema（projects、kanban_status）了解現有狀態欄位
- [x] 新增 db/migrations/002_sla_tracking.sql：projects 加 due_date、sla_hours、version 欄位
- [x] 新增後端 GET /api/sla-status：查詢即將逾期（due_date < NOW()+48h）與已逾期專案
- [x] dashboard/public/kanban.html：逾期專案卡片顯示紅色警示標籤（sla-overdue 紅色左框、sla-warning 橙色左框）
- [x] Telegram Bot：每日一次主動通知即將逾期案件（cron-like setInterval 每小時檢查）
- [x] 寫入摘要至 .dispatch/tasks/phase54-sla-tracking/output.md
