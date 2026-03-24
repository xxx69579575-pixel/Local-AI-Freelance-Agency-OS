# WF-01 Scoring Pipeline Fix — Validation Steps

## 修復摘要

**根因**：`executeQuery` 對 INSERT 只回傳 `{ success: true }`，後續節點拿不到 `lead_id`。

**修復方式**：刪除無效的 `node-wf01-08c`（Postgres - Fetch Inserted Lead），改以兩個新節點替代：
- `node-wf01-08d`（Code - Prepare Scoring Input）：從 `Expand Leads` 的上游資料重建 scoring input
- `node-wf01-08e`（Postgres - Get Lead ID）：SELECT 取得真實 `id`

新的 pipeline 順序：
```
Insert Lead (08) → Code - Prepare Scoring Input (08d) → Postgres - Get Lead ID (08e) → HTTP - Score Lead (09) → ...
```

---

## Step 1：同步 workflow 到 DB

```bash
# 從專案根目錄執行
DB_HOST=localhost DB_PORT=5432 DB_USER=n8n DB_PASS=n8n DB_NAME=n8n \
  bash db/scripts/sync-wf01-to-db.sh
```

## Step 2：重啟 n8n

```bash
docker compose restart n8n
```

或完整重啟：

```bash
docker compose down && docker compose up -d
```

## Step 3：確認 workflow 已載入

```bash
# 確認 n8n 正常啟動
docker compose logs n8n --tail=20

# 確認 workflow_entity 已更新
docker exec -it agency-postgres psql -U n8n -d n8n -c \
  "SELECT id, name, active, \"updatedAt\" FROM workflow_entity WHERE id = 'wf-01-lead-scraper';"

# 確認 workflow_history 有新紀錄
docker exec -it agency-postgres psql -U n8n -d n8n -c \
  "SELECT id, \"workflowId\", \"createdAt\" FROM workflow_history WHERE \"workflowId\" = 'wf-01-lead-scraper' ORDER BY \"createdAt\" DESC LIMIT 3;"
```

## Step 4：手動觸發 WF-01 測試

在 n8n UI 開啟 WF-01，按 "Test workflow"（或等下一個 hourly cron）。

## Step 5：驗證 scoring 已執行

```bash
# 確認 leads 表有 scored 資料
docker exec -it agency-postgres psql -U n8n -d agency -c \
  "SELECT id, external_id, source, status, risk_score, fit_score, expected_profit_score, scored_at
   FROM leads
   WHERE scored_at IS NOT NULL
   ORDER BY scored_at DESC
   LIMIT 5;"

# 確認 status 已更新為 pending_decision
docker exec -it agency-postgres psql -U n8n -d agency -c \
  "SELECT COUNT(*) AS scored_count FROM leads WHERE status = 'pending_decision';"
```

## Step 6：驗證 scorer log

```bash
# 查看 scorer service 日誌
docker compose logs agency-ollama-scorer --tail=50

# 確認 agent_logs 有成功紀錄
docker exec -it agency-postgres psql -U n8n -d agency -c \
  "SELECT agent_name, action, status, output_summary, created_at
   FROM agent_logs
   WHERE agent_name = 'scraper' AND action = 'scrape_success'
   ORDER BY created_at DESC
   LIMIT 5;"
```

## 預期結果

| 檢查項目 | 預期值 |
|----------|--------|
| `leads.scored_at` | 非 NULL（有時間戳記） |
| `leads.status` | `pending_decision` |
| `leads.risk_score` | 0–100 數值 |
| `agent_logs` scrape_success | 有新紀錄 |
| n8n execution 狀態 | Success（綠色） |

## 如果 Scorer 仍未收到 lead_id

檢查 `node-wf01-08e` 的 SELECT 是否回傳資料：
```bash
docker exec -it agency-postgres psql -U n8n -d agency -c \
  "SELECT id, external_id, source FROM leads ORDER BY created_at DESC LIMIT 3;"
```
確認 `external_id` 欄位非 NULL，且 source 符合 `pro360` / `tasker`。
