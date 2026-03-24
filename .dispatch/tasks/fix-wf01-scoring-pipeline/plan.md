# Fix WF-01: Scoring Pipeline 無法執行

## 問題根因

n8n Postgres `executeQuery` 對 INSERT/UPDATE/DELETE 永遠只回傳 `{ success: true }`，
不論 SQL 中有無 `RETURNING` 子句。導致 HTTP - Score Lead 收到空資料，scoring 從未執行。

---

## Checklist

- [x] 讀取 `n8n/workflows/WF-01-lead-scraper.json`，確認現有 node 清單、connections、座標
- [x] 刪除 node-wf01-08c（Postgres - Fetch Inserted Lead，無效舊節點），並移除其 connections
- [x] 新增 node-wf01-08d（Code - Prepare Scoring Input）：
      位置在 node-wf01-08 右方（+300px x）；
      JS 從 `$('Expand Leads').item.json` 取 external_id/source/title/description/budget_raw/tech_stack
- [x] 新增 node-wf01-08e（Postgres - Get Lead ID）：
      位置在 node-wf01-08d 右方（+300px x）；
      SQL: SELECT id, external_id, source, title, description, budget_raw, tech_stack FROM leads WHERE source='{{$json.source}}' AND external_id='{{$json.external_id}}' LIMIT 1
- [x] 更新 connections：Insert Lead(08) → 08d → 08e → HTTP Score Lead
- [x] 讀取 `db/` 目錄確認現有 migration/script 結構，新增 `db/scripts/sync-wf01-to-db.sh`：
      內容為將更新後的 WF-01 JSON upsert 到 workflow_entity + 插入 workflow_history 的指令
      （符合 memory feedback：必須同時更新兩張表）
- [x] 寫驗證步驟到 `.dispatch/tasks/fix-wf01-scoring-pipeline/output.md`：
      包含 docker restart 指令、scorer log 驗證指令、DB 驗證 SQL
