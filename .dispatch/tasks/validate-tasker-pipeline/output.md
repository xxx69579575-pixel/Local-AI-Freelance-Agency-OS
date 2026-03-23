# Tasker Pipeline 靜態驗證報告

生成時間：2026-03-23
分析方式：純靜態分析（未實際執行）

---

## 鏈路總覽

```
tasker.js → POST /scrape (server.js)
  → n8n: Set Sources → HTTP Scrape Source
  → IF Scrape Success → Expand Leads
  → Postgres Check Duplicate → IF Is New Lead
  → Postgres Insert Lead → Postgres Log Insert Success
  → HTTP Score Lead (scorer:3002/score)
    → Ollama /api/chat (host.docker.internal:11434)
  → Postgres Update Score
  → Redis rpush queue:notify
  ↓ (WF-02, 每 5 分鐘)
  → Redis lrange queue:notify
  → Postgres Get Lead Details
  → Code Format Telegram Message
  → HTTP Telegram sendMessage
  → Redis lrem + set session
  → Postgres Log Notified
```

---

## ✅ 就緒項目

| # | 項目 | 說明 |
|---|------|------|
| 1 | **tasker.js 輸出格式** | 輸出 `external_id`, `source`, `url`, `title`, `description`, `budget_raw`, `deadline_raw`, `client_name`, `tech_stack` — 所有 Expand Leads 需要的欄位均存在 |
| 2 | **Expand Leads 讀取邏輯** | `data.leads \|\| data.results \|\| []` 正確處理 `/scrape` 返回的 `{ success, source, count, leads }` 結構 |
| 3 | **server.js /scrape 端點** | `require('./scrapers/${source}')` 動態載入，`source: 'tasker'` 會正確載入 `tasker.js` |
| 4 | **external_id 穩定性** | `deriveExternalId()` 從 URL 路徑提取 `TK\w+`，格式為 `tasker-TK26032309GMEF77`，重複執行不會產生重複 ID |
| 5 | **Ollama API 格式** | scorer/server.js 使用 `POST /api/chat` + `{ model, stream: false, format: 'json', messages }` — 與 Ollama 標準 API 相容，`qwen2.5:7b` 和 `llama3.2` 均支援 |
| 6 | **Scorer 輸入欄位** | n8n `HTTP - Score Lead` 傳入 `lead_id(=$json.id)`, `title`, `description`, `budget_raw`, `tech_stack` — 均來自 INSERT RETURNING，與 scorer `POST /score` 需求一致 |
| 7 | **Telegram 環境變數** | `.env` 中 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID` 均已設定（非 placeholder 值） |
| 8 | **OLLAMA_BASE_URL** | `.env` 設定為 `http://host.docker.internal:11434`，Docker 容器內可正確連到宿主機 Ollama |
| 9 | **WF-02 Telegram 節點** | Telegram sendMessage URL 使用 `$env.TELEGRAM_BOT_TOKEN`、`$env.TELEGRAM_CHAT_ID` — 可正確讀取 .env |
| 10 | **Scorer JSON 解析容錯** | scorer/server.js 包含 markdown 程式碼塊提取邏輯（regex `\{[\s\S]*\}`），即使 LLM 回傳帶有 markdown 也能解析 |

---

## ❌ 阻塞項目（需修正才能跑通）

### BUG-01：`ollama_model` vs `model` 欄位名稱不符

**位置：** `n8n/workflows/WF-01-lead-scraper.json` → node `Postgres - Update Score`（node-wf01-10）

**問題：**
- scorer (`services/scorer/server.js:174`) 返回 `ollama_model: OLLAMA_MODEL`
- UPDATE 查詢使用 `{{ $json.model }}` ← 此欄位不存在於 scorer 回應

```sql
-- 當前（錯誤）
ollama_model = '{{ $json.model }}'

-- 應改為
ollama_model = '{{ $json.ollama_model }}'
```

**後果：** `leads.ollama_model` 欄位永遠存入空字串，不影響核心流程但造成資料遺失。

---

### BUG-02：WF-02 Telegram Notifier 為非啟用狀態

**位置：** `n8n/workflows/WF-02-telegram-notifier.json` → `"active": false`

**問題：** WF-02 匯入 n8n 後預設為停用，Redis queue 的 lead 不會觸發 Telegram 通知。

**修正：** 匯入 n8n 後手動啟用 WF-02，或將 JSON 中 `"active"` 改為 `true`（n8n 匯入時通常會重置此值，需在 UI 手動啟用）。

---

## ⚠️ 需確認項目

### WARN-01：n8n Credential ID 為 placeholder

**位置：** 所有 Postgres 和 Redis 節點的 `credentials`

```json
"credentials": {
  "postgres": { "id": "POSTGRES_CREDENTIAL_ID", "name": "Agency Postgres" }
}
```

這些是 placeholder，需要在 n8n UI 中實際建立對應的 Postgres / Redis 憑證，並讓 n8n 重新綁定。匯入後執行前必須確認。

---

### WARN-02：`deadline_raw` 未寫入資料庫

**位置：** WF-01 `Postgres - Insert Lead`（node-wf01-08）

tasker.js 輸出 `deadline_raw`（如 `"2024/01/15"`），但 INSERT 欄位清單為：
```
external_id, source, url, title, description, budget_raw, tech_stack, status
```
`deadline_raw` 未列入，該欄位被靜默丟棄。Scorer 可從描述中估算 deadline，但原始截止日期資訊遺失。

**影響：** 低（scorer 的估算值寫入 `deadline` 欄位），但若需要儲存原始值需另外調整。

---

### WARN-03：WF-02 Redis LRANGE 批次處理邏輯

**位置：** WF-02 node `Code - Parse Lead IDs`（node-wf02-04）

```js
const raw = String($json.value || '');
const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
```

n8n Redis 節點的 `lrange` 回傳值可能是陣列（每個元素一個 `$json`），而非逗號分隔字串。若 n8n Redis 節點返回多個 items，`$json.value` 可能只包含第一個元素，其餘被忽略。需實際執行確認 n8n Redis lrange 的輸出格式。

---

### WARN-04：OLLAMA_MODEL 與 .env.example 不一致

- `.env`：`OLLAMA_MODEL=qwen2.5:7b-instruct-q4_0`
- `.env.example`：`OLLAMA_MODEL=llama3.2`

需確認 Ollama 本機已 `ollama pull qwen2.5:7b-instruct-q4_0`，否則 scorer 呼叫會返回 404。

---

### WARN-05：Postgres 缺少 `OLLAMA_BASE_URL` 的 .env 注入到 n8n

scorer 服務透過 Docker Compose 注入 `OLLAMA_BASE_URL`，但 n8n 的 `$env.OLLAMA_BASE_URL` 是否可用取決於 docker-compose.yml 的 n8n 環境變數設定。Telegram 節點已使用 `$env.TELEGRAM_*` 語法——需確認 n8n 容器的 environment 區塊包含這些變數。

---

## 綜合判斷

| 層 | 狀態 | 說明 |
|----|------|------|
| tasker.js 爬蟲 | ✅ 可用 | 輸出格式正確，欄位齊全 |
| server.js /scrape | ✅ 可用 | 動態路由正確，錯誤處理完整 |
| n8n Expand Leads | ✅ 可用 | 解析邏輯正確 |
| Postgres 去重 + 插入 | ✅ 可用（需綁憑證） | 邏輯正確，credential 為 placeholder |
| Scorer (Ollama) | ✅ 格式正確 / ❌ UPDATE 欄位名 bug | `ollama_model` vs `model` 須修正 |
| Redis queue | ✅ 可用 | rpush/lrange 語意正確 |
| Telegram 通知 | ❌ WF-02 停用 | 需在 n8n UI 啟用 WF-02 |

**可立即跑通所需的最少修正：**
1. 修正 WF-01 UPDATE 查詢 `$json.model` → `$json.ollama_model`
2. 在 n8n UI 建立 Postgres / Redis 憑證並重新綁定
3. 在 n8n UI 啟用 WF-02 Telegram Notifier
4. 確認 Ollama 已 pull `qwen2.5:7b-instruct-q4_0`
