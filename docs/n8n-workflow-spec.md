# n8n Workflow MVP 規格書 — Local AI Freelance Agency OS

> **版本**：v1.0
> **日期**：2026-03-22
> **範圍**：Phase 1 MVP — 接案監控核心

---

## 1. Workflow 總覽

Phase 1 MVP 包含 3 條主要 workflow：

| ID | Workflow 名稱 | 觸發方式 | 說明 |
|----|---------------|----------|------|
| WF-01 | Lead Scraper | Cron (每小時) | 抓取案件 → 評分 → 寫入 DB |
| WF-02 | Telegram Notifier | DB 輪詢 (每5分鐘) | 推播待決策案件給使用者 |
| WF-03 | Decision Handler | Webhook (POST) | 接收 Telegram 回覆 → 更新狀態 |

---

## 2. WF-01: Lead Scraper Workflow

### 流程圖

```
[Cron: 每小時整點]
        │
        ▼
[Set: 設定抓取目標清單]
    sources: ['pro360', 'chutask']
        │
        ▼
[Split In Batches: 逐一處理 source]
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
[HTTP Request: 呼叫 Playwright]    [記錄 agent_log: started]
    POST http://scraper:3001/scrape
    body: { source, limit: 20 }
        │
        ▼
[IF: 抓取成功?]
    success ──────────────────────────┐
    failure ────────────────────────┐ │
        │                           │ │
        ▼                           │ ▼
[PostgreSQL: 檢查 external_id]     │ [記錄 agent_log: failed]
    SELECT 1 FROM leads            │ [繼續下一個 source]
    WHERE source=? AND external_id=?│
        │                           │
  exists ─────────────────────┐    │
  new ─────────────────────┐  │    │
        │                   │  │    │
        ▼                   │  │    │
[PostgreSQL: INSERT lead]   │  │    │
    status = 'new'          │  │    │
        │                   │  │    │
        ▼                   ▼  ▼    ▼
[記錄 agent_log: success]   [跳過重複] [繼續]
        │
        ▼
[HTTP Request: 呼叫 Ollama 評分]
    POST http://ollama-scorer:3002/score
    body: { lead_id }
        │
        ▼
[PostgreSQL: UPDATE leads 評分]
    status = 'pending_decision'
    scored_at = NOW()
        │
        ▼
[Redis: RPUSH queue:notify {lead_id}]
```

### 節點細節

#### Cron Node
```json
{
  "rule": "0 * * * *",
  "timezone": "Asia/Taipei"
}
```

#### HTTP Request — Playwright Scraper
```
URL: http://scraper:3001/scrape
Method: POST
Headers: { "Content-Type": "application/json" }
Body:
{
  "source": "{{ $json.source }}",
  "limit": 20,
  "delay_min_ms": 3000,
  "delay_max_ms": 10000
}
```

#### HTTP Request — Ollama Scorer
```
URL: http://ollama-scorer:3002/score
Method: POST
Body:
{
  "lead_id": "{{ $json.id }}",
  "title": "{{ $json.title }}",
  "description": "{{ $json.description }}",
  "budget_raw": "{{ $json.budget_raw }}",
  "tech_stack": "{{ $json.tech_stack }}"
}
```

#### PostgreSQL — INSERT lead
```sql
INSERT INTO leads (
    external_id, source, url, title, description,
    budget_raw, tech_stack, status
) VALUES (
    '{{ $json.external_id }}',
    '{{ $json.source }}',
    '{{ $json.url }}',
    '{{ $json.title }}',
    '{{ $json.description }}',
    '{{ $json.budget_raw }}',
    ARRAY[{{ $json.tech_stack.join(',') }}]::TEXT[],
    'new'
)
RETURNING id
```

---

## 3. WF-02: Telegram Notifier Workflow

### 流程圖

```
[Cron: 每5分鐘]
        │
        ▼
[Redis: LRANGE queue:notify 0 4]
  (取最多 5 筆待通知)
        │
        ▼
[IF: queue 有資料?]
  empty → 結束
  has data ↓
        │
        ▼
[Split In Batches: 逐一處理 lead_id]
        │
        ▼
[PostgreSQL: SELECT lead 詳情]
    WHERE id = ? AND status = 'pending_decision'
        │
        ▼
[Function: 組合 Telegram 訊息]
        │
        ▼
[HTTP Request: Telegram sendMessage]
    inline keyboard: 聯絡報價/放棄/稍後
        │
        ▼
[Redis: LREM queue:notify 1 {lead_id}]
[Redis: SET telegram:session:{chat_id} {lead_id}]
[記錄 agent_log: notified]
```

### Telegram 訊息格式

```
📋 *新案件通知*

📌 *{{ title }}*
🌐 來源：{{ source }}
💰 預算：{{ budget_estimate }}
📅 截止：{{ deadline }}
🛠 技術：{{ tech_stack | join(', ') }}

📊 *AI 評分*
⚠️ 風險：{{ risk_score }}/10
✅ 適合：{{ fit_score }}/10
💵 利潤：{{ expected_profit_score }}/10

💬 {{ reason_summary }}

---
請選擇：
```

### Inline Keyboard

```json
{
  "inline_keyboard": [[
    {
      "text": "✅ 聯絡報價",
      "callback_data": "action:quote:{{ lead_id }}"
    },
    {
      "text": "❌ 放棄",
      "callback_data": "action:reject:{{ lead_id }}"
    },
    {
      "text": "⏰ 稍後處理",
      "callback_data": "action:later:{{ lead_id }}"
    }
  ]]
}
```

---

## 4. WF-03: Decision Handler Workflow

### 流程圖

```
[Webhook: POST /webhook/telegram-decision]
  body: { action, lead_id, chat_id, message_id }
        │
        ▼
[Switch: action]
    'quote' ──────────────────────────┐
    'reject' ─────────────────────┐   │
    'later' ──────────────────┐   │   │
                               │   │   │
                               ▼   ▼   ▼
                        [稍後處理] [放棄] [聯絡報價]
                               │   │   │
                               ▼   ▼   ▼
                        [PostgreSQL: UPDATE leads]
                         status = 'pending_decision'
                                  │
                         status = 'rejected'
                                  │
                         status = 'pending_quote'
                                      │
                                      ▼
                         [觸發 WF-04: Quotation Generator]
```

### 詳細分支

#### 分支 A: 聯絡報價 (quote)

```
[PostgreSQL: UPDATE leads SET status = 'pending_quote']
        │
        ▼
[HTTP Request: 呼叫 Ollama 產生報價草稿]
    POST http://ollama-scorer:3002/quotation
    body: { lead_id }
        │
        ▼
[PostgreSQL: INSERT quotations (draft_content)]
        │
        ▼
[Telegram: 發送報價草稿]
    附加按鈕: [✅ 確認送出] [✏️ 手動修改]
        │
        ▼
[記錄 agent_log]
```

#### 分支 B: 放棄 (reject)

```
[PostgreSQL: UPDATE leads SET status = 'rejected']
        │
        ▼
[Telegram: 發送確認訊息]
    "已將案件標記為放棄 ✓"
        │
        ▼
[記錄 agent_log]
```

#### 分支 C: 稍後處理 (later)

```
[PostgreSQL: UPDATE leads SET status = 'pending_decision']
  (狀態不變，但更新 status_updated_at)
        │
        ▼
[Telegram: 發送確認訊息]
    "已標記為稍後處理，明天會再提醒你 ⏰"
        │
        ▼
[記錄 agent_log]
```

### Webhook 安全

- Telegram Bot token 驗證（比對 `X-Telegram-Bot-Api-Secret-Token` header）
- 僅接受來自 Telegram IP 範圍的請求

---

## 5. 環境變數與設定

### n8n 環境變數（.env）

```env
# n8n
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_password

# DB
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=agency_os
DB_POSTGRESDB_USER=agency_user
DB_POSTGRESDB_PASSWORD=your_password

# Redis
QUEUE_BULL_REDIS_HOST=redis
QUEUE_BULL_REDIS_PORT=6379

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Ollama
OLLAMA_BASE_URL=http://ollama:11434

# Scraper
SCRAPER_BASE_URL=http://scraper:3001
```

---

## 6. 外部服務 API 規格

### Scraper Service (http://scraper:3001)

#### POST /scrape

**Request:**
```json
{
  "source": "pro360",
  "limit": 20,
  "delay_min_ms": 3000,
  "delay_max_ms": 10000
}
```

**Response:**
```json
{
  "success": true,
  "source": "pro360",
  "count": 15,
  "leads": [
    {
      "external_id": "abc123",
      "url": "https://...",
      "title": "案件標題",
      "description": "案件描述",
      "budget_raw": "NT$5000-10000",
      "tech_stack": ["React", "Node.js"],
      "scraped_at": "2026-03-22T10:00:00Z"
    }
  ]
}
```

#### GET /health

```json
{ "status": "ok", "playwright": "ready" }
```

---

### Ollama Scorer Service (http://ollama-scorer:3002)

#### POST /score

**Request:**
```json
{
  "lead_id": 42,
  "title": "案件標題",
  "description": "案件描述...",
  "budget_raw": "NT$5000",
  "tech_stack": ["React", "Node.js"]
}
```

**Response:**
```json
{
  "lead_id": 42,
  "budget_estimate": "NT$5000-8000",
  "deadline": "2026-04-15",
  "risk_score": 4,
  "fit_score": 8,
  "expected_profit_score": 7,
  "recommended_action": "quote",
  "reason_summary": "技術棧完全符合，預算合理，截止日期寬裕，風險低。",
  "model": "llama3.2",
  "latency_ms": 1250
}
```

#### POST /quotation

**Request:**
```json
{
  "lead_id": 42
}
```

**Response:**
```json
{
  "lead_id": 42,
  "draft": "您好，...\n\n本次報價為 NT$8,000...",
  "model": "llama3.2",
  "latency_ms": 2300
}
```

---

## 7. 錯誤處理策略

| 場景 | 處理方式 |
|------|----------|
| Playwright 抓取失敗 | 重試 3 次，間隔 30 秒；3 次後記錄 agent_log failed |
| Ollama 評分超時 (>30s) | 記錄 agent_log failed；案件保持 'scoring' 狀態，下次 cron 重試 |
| Telegram 發送失敗 | 重試 2 次；失敗後仍將 lead_id 留在 notify queue |
| PostgreSQL 連線失敗 | n8n 自動重試；超過閾值後停止 workflow |
| Webhook 收到無效 action | 忽略，記錄 agent_log |

---

## 8. 監控指標

n8n 執行後需寫入 `agent_logs` 的關鍵指標：

| agent_name | action | 說明 |
|------------|--------|------|
| scraper | scrape_start | 開始抓取 |
| scraper | scrape_success | 抓取成功（output: count） |
| scraper | scrape_failed | 抓取失敗（error_message） |
| ollama | score_start | 開始評分 |
| ollama | score_success | 評分完成（duration_ms） |
| ollama | score_failed | 評分失敗 |
| telegram | notify_sent | 通知已發送 |
| telegram | decision_received | 收到決策回覆（action） |
| bootstrapper | project_created | 專案建立完成 |
