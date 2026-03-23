# postgres-schema 任務完成摘要

**完成時間**：2026-03-22
**輸出檔案**：`db/init.sql`

## 建立內容

| 表名 | 欄位數 | 說明 |
|------|--------|------|
| `leads` | 24 | 案件資料，含 14 狀態 CHECK constraint |
| `projects` | 17 | 成交專案，含 6 狀態 CHECK constraint |
| `kanban_status` | 8 | 狀態變更日誌 |
| `agent_logs` | 12 | Agent 操作日誌，含 JSONB metadata |
| `quotations` | 10 | 報價記錄 |
| `revisions` | 12 | 修改單，含 UNIQUE(project_id, revision_number) |

## Indexes（共 12 個）

- `idx_leads_status`, `idx_leads_source`, `idx_leads_scraped_at`, `idx_leads_external`（partial unique）
- `idx_projects_status`, `idx_projects_slug`（unique）
- `idx_kanban_entity`, `idx_kanban_created_at`
- `idx_agent_logs_agent`, `idx_agent_logs_status`, `idx_agent_logs_created_at`, `idx_agent_logs_entity`
- `idx_quotations_lead`
- `idx_revisions_project`, `idx_revisions_status`

## Trigger Functions

| 函式 | 觸發表 | 說明 |
|------|--------|------|
| `update_updated_at()` | leads, projects, quotations, revisions | BEFORE UPDATE 自動更新 updated_at |
| `log_lead_status_change()` | leads | AFTER UPDATE 寫入 kanban_status 日誌 |

## 關鍵設計決策

- **循環 FK 處理**：`leads.project_id` 欄位先建立（無 FK），待 `projects` 表建立後以 `ALTER TABLE leads ADD CONSTRAINT fk_leads_project` 補上，避免循環相依錯誤。
- **Trigger function 順序**：兩個 trigger function 均定義在所有 `CREATE TRIGGER` 陳述式之前。
- **PostgreSQL 15 相容**：使用標準語法，`IF NOT EXISTS` 防止重複執行錯誤。

## 執行方式

```bash
psql -U postgres -c "CREATE DATABASE agency_os;"
psql -U postgres -d agency_os -f db/init.sql
```
