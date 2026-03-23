# Phase 1.8 + 1.9 — Telegram Bot 實作完成

## 產出清單

| 檔案 | 說明 |
|------|------|
| `services/telegram-bot/package.json` | 依賴：node-telegram-bot-api, express, pg, ioredis, dotenv |
| `services/telegram-bot/Dockerfile` | node:20-slim，port 3004 |
| `services/telegram-bot/bot.js` | 主程式 — Redis poller + callback handler + /health |
| `services/telegram-bot/formatter.js` | MarkdownV2 格式化 + inline keyboard builder |
| `docker-compose.yml` | 新增 `telegram-bot` service（port 3004，depends_on postgres + redis） |

## Phase 1.8 — sendLeadNotification

- 每 30 秒（可調 `NOTIFY_POLL_INTERVAL_MS`）呼叫 `redis.lpop('queue:notify')` 取得 lead_id
- 查詢 Postgres `leads` 表，確認 status = `pending_decision` 才發送
- 訊息格式：繁體中文 MarkdownV2，包含標題、來源、預算、截止、技術棧、AI 三項評分、摘要、案件連結
- Inline keyboard：✅ 聯絡報價 / ❌ 放棄 / ⏰ 稍後處理（callback_data 格式 `action:<action>:<lead_id>`）
- 發送成功後寫入 `telegram:session:{chat_id}:msg:{message_id}` 到 Redis（24h TTL）
- 寫入 `agent_logs`: agent_name=`telegram`, action=`notify_sent`

## Phase 1.9 — callback_query handler

| 按鈕 | action | 新狀態 |
|------|--------|--------|
| ✅ 聯絡報價 | `quote` | `pending_quote` |
| ❌ 放棄 | `reject` | `rejected` |
| ⏰ 稍後處理 | `later` | `pending_decision`（維持不變，稍後再通知） |

- 直接更新 Postgres `leads.status`（不轉發到 n8n webhook）
- `answerCallbackQuery` 移除按鈕 loading
- `editMessageReplyMarkup` 移除原訊息鍵盤
- 回覆確認訊息給使用者
- 寫入 `agent_logs`: action=`decision_received`

## 環境變數

| 變數 | 說明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot token（必填） |
| `TELEGRAM_CHAT_ID` | 接收通知的 chat ID（必填） |
| `POSTGRES_HOST/DB/USER/PASSWORD` | Postgres 連線 |
| `REDIS_HOST/PORT/PASSWORD` | Redis 連線 |
| `NOTIFY_POLL_INTERVAL_MS` | 輪詢間隔，預設 30000ms |

## 備註

- port 3003 已由 dashboard 服務佔用，telegram-bot 使用 **3004**
- 僅記錄人工決策，不自動送出報價（符合 PRD 人工審核原則）
- 失敗通知會重新推回 `queue:notify` 尾端以便重試
