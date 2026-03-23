# Phase 5.6 — 成本追蹤 Output

完成日期：2026-03-22

## 變更摘要

### 1. `db/migrations/004_cost_tracking.sql` （新增）
- 新增 `cost_logs` 表：`id / service / model / prompt_tokens / completion_tokens / cost_usd / created_at`
- 索引：`created_at`、`service`

### 2. `services/scorer/server.js`
- 引入 `pg.Pool`；`DB_URL` 未設定時自動跳過（graceful degradation）
- 新增 `logCost(service, ollamaData)` 函數：從 `ollamaData.prompt_eval_count` / `eval_count` 取 token 數；Ollama 本地 `cost_usd = 0`；fire-and-forget，不阻斷主流程
- `/score` 回應後呼叫 `logCost('scorer', ollamaData)`
- `/quotation` 回應後呼叫 `logCost('quotation', ollamaData)`

### 3. `services/scorer/package.json`
- 新增 `pg ^8.12.0` 依賴

### 4. `docker-compose.yml`
- `ollama-scorer` 服務新增 `DB_URL` 環境變數
- 新增 `depends_on: postgres: condition: service_healthy`

### 5. `services/dashboard/server.js`
- 新增 `GET /api/cost-summary` 端點
  - 回傳：`{ total_tokens, total_cost_usd, by_service: [...], by_day: [...] }`
  - 聚合過去 30 天每日明細

### 6. `services/dashboard/public/kanban.html`
- KPI 區塊新增「本月 tokens」卡片（`id="kpi-tokens"`）
- `fetchKpi()` 同時並行呼叫 `/api/cost-summary`；tokens ≥ 1000 以 `K` 縮寫顯示

## 注意事項
- `comm-assistant` 服務目錄不存在（`services/comm-assistant/`），僅對 scorer 做 cost logging
- 若 DB 連線失敗，cost logging 錯誤只記 console.error，不影響評分/報價主流程
