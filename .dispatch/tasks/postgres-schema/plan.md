# 建立 PostgreSQL Schema

- [x] 讀取 docs/db-schema.md 確認 6 張資料表規格 — leads/projects/kanban_status/agent_logs/quotations/revisions；注意 leads↔projects 循環 FK，需 ALTER TABLE 處理
- [x] 建立 db/init.sql：leads 表（含 14 個 Kanban 狀態 CHECK constraint 與所有 INDEX）
- [x] 加入 projects、kanban_status、agent_logs 表定義
- [x] 加入 quotations、revisions 表定義
- [x] 加入觸發器：update_updated_at()、log_lead_status_change()；函式定義在 CREATE TRIGGER 之前
- [x] 確認 SQL 語法可在 PostgreSQL 15 直接執行，寫入完成摘要到 .dispatch/tasks/postgres-schema/output.md
