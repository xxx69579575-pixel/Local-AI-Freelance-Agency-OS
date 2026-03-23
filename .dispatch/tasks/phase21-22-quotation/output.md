# Phase 2.1 + 2.2 — Quotation Assistant + Telegram 審核流程 — 完成摘要

## 實作範圍

### Phase 2.1 — Quotation Draft Generator (scorer service)

**`services/scorer/quotation.js`** (新建)
- `buildQuotationPrompt({ title, description, budget_raw, tech_stack, client_name, reason_summary })`
- 系統提示要求 Ollama 以繁體中文回傳結構化 JSON：
  `{ subject, body, price_estimate, timeline_estimate, notes }`

**`services/scorer/server.js`** (更新 POST /quotation)
- 從 `./quotation` 引入 `buildQuotationPrompt`
- 啟用 `format: 'json'` → Ollama 強制回傳 JSON
- 新增 JSON fallback 解析（markdown code fence 容錯）
- 新增 `client_name` 參數
- Response 改為結構化：`{ lead_id, subject, body, price_estimate, timeline_estimate, notes, ollama_model, latency_ms }`

### Phase 2.2 — Telegram Draft Approval Flow (telegram-bot service)

**`services/telegram-bot/formatter.js`** (新增)
- `formatQuoteDraft(draft, lead)` — MarkdownV2 格式報價草稿通知，含主旨/報價/時程/正文
- `buildQuoteKeyboard(leadId)` — inline keyboard: [✅ 確認送出, ✏️ 修改草稿, ❌ 取消]
  callback_data 格式：`quote:<action>:<lead_id>`

**`services/telegram-bot/bot.js`** (更新)

新增 DB helpers:
- `insertQuotation(leadId, draftJson)` → INSERT quotations, return id
- `approveQuotation(quotationId)` → UPDATE approved_at + final_content

新增 `SCORER_URL` env var (default: `http://scorer:3002`)

新增 `sendQuoteDraftNotification(leadId)`:
1. fetchLead (status 必須為 `pending_quote`)
2. POST ${SCORER_URL}/quotation → 取得結構化草稿
3. `insertQuotation` → 持久化草稿，取得 quotation_id
4. `bot.sendMessage` 含草稿 + buildQuoteKeyboard
5. Redis session 儲存 `telegram:quote:session:<chatId>:msg:<msgId>` → `{ lead_id, quotation_id }` (TTL 24h)

新增 `pollQuoteQueue()` — 每 `POLL_INTERVAL_MS` ms 從 `queue:quote` lpop

Phase 1.9 callback_query 修正與擴充:
- **修正 bug**: `query.callback_data` → `query.data`（node-telegram-bot-api API 正確欄位）
- **重構**: 依 namespace 分派 (`action:*` vs `quote:*`)
- `action:quote` 時額外 `rpush('queue:quote', leadId)` → 觸發 Phase 2.2 流程
- `quote:confirm` → `updateLeadStatus(quoted)` + `approveQuotation` + 確認訊息（⚠️ 提醒人工寄信）
- `quote:revise`  → 提示複製草稿修改，鍵盤保持可用
- `quote:cancel`  → `updateLeadStatus(rejected)` + 確認訊息

## 資料流

```
Phase 1.9: user clicks [✅ 聯絡報價]
  → leads.status = pending_quote
  → redis rpush queue:quote

pollQuoteQueue (every 30s)
  → sendQuoteDraftNotification(leadId)
    → POST /quotation (Ollama llama3.2)
    → INSERT quotations (draft_content = JSON)
    → Telegram: 報價草稿 + [✅確認 / ✏️修改 / ❌取消]

User clicks [✅ 確認送出]
  → leads.status = quoted
  → quotations.approved_at = NOW(), final_content = draft_content
  → agent_logs entry
  → Telegram: "報價已確認，請手動寄信"

User clicks [❌ 取消]
  → leads.status = rejected
  → Telegram: "報價已取消"
```

## 重要限制確認

- ✅ Bot 從不自動送出報價，`sent_at` 欄位由人工後續填入
- ✅ 只修改 services/scorer/ 和 services/telegram-bot/，未建立新服務
- ✅ quotations 表 schema 完全符合 db/init.sql 定義

## 注意事項

- `telegram-bot` service 使用 Node 18+ 內建 `fetch` global（無需新增 node-fetch 依賴）
- `SCORER_URL` 可透過 .env 設定（Docker Compose 中預設指向 `http://scorer:3002`）
- 若需在 .env.example 加入 `SCORER_URL`，可手動補充
