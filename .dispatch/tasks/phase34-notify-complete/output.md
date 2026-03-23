# Phase 3.4 — 完成摘要

## 新增檔案

### `services/telegram-bot/notify-complete.js`

| 功能 | 說明 |
|------|------|
| `runMigration(db)` | 啟動時執行一次，確保 `agent_logs.notified BOOLEAN` 欄位存在 |
| `pollCompletedAgents(bot, db, chatId)` | 每 30 秒查詢 `agent_logs WHERE status='completed' AND notified=false` |
| `buildCompletionMessage(log)` | 組合 MarkdownV2 通知訊息（agent名稱、專案ID、交付摘要前200字） |
| `buildCompletionKeyboard(projectId)` | 建立 inline keyboard：`confirm_{id}` / `revise_{id}` |
| `registerCompletionCallbacks(bot, db, chatId)` | 註冊 `bot.on('callback_query')` 處理確認/修改回應 |
| `startCompletionPoller(bot, db, chatId)` | 公開入口：執行 migration → 註冊 callbacks → 啟動 setInterval |

**Callback 行為：**
- `confirm_{projectId}` → `UPDATE projects SET kanban_status='待最終確認'`
- `revise_{projectId}` → `POST {REVISION_MANAGER_URL}/revision { project_id }`

**環境變數：**
- `REVISION_MANAGER_URL`（預設 `http://revision-manager:3007`）

## 修改檔案

### `services/telegram-bot/bot.js`

1. `require('./notify-complete')` — 引入模組
2. 在 `callback_query` handler 頂部加入早返回：若 data 符合 `/^(confirm|revise)_\d+$/` 則跳過（交由 notify-complete 處理）
3. 在 `start()` 中呼叫 `await startCompletionPoller(bot, db, CHAT_ID)`
