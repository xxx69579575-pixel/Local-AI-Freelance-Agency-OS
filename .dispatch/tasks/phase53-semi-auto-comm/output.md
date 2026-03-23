# Phase 5.3 — 半自動客戶溝通 完成摘要

## 新增 / 修改的檔案

### 新服務：`services/comm-assistant/`

| 檔案 | 說明 |
|------|------|
| `server.js` | Express 服務，port 3009 |
| `package.json` | 依賴：express, pg, dotenv |
| `Dockerfile` | node:20-slim，EXPOSE 3009 |

#### API 端點

**`POST /draft-reply`**
- Body: `{ project_id, client_message }`
- 查詢 DB 取得專案 title
- 呼叫 Ollama `/api/chat`（繁體中文，專業回覆風格）
- 回傳: `{ draft, project_id, project_slug, workspace_path }`

**`POST /log-reply`**
- Body: `{ project_id, draft }`
- append 到 `projects/{id}-{slug}/client-log.md`（格式：`## ISO 時間戳 + 草稿內文`）
- 不自動送出給客戶

**`GET /health`**
- 回傳 Ollama 可達性狀態

---

### 修改：`services/telegram-bot/bot.js`

**新增 `/reply` 指令**
```
/reply <project_id> <client message...>
```
- 顯示「⏳ 正在生成…」ack 訊息
- 呼叫 comm-assistant `POST /draft-reply`
- 回傳草稿 + inline keyboard：
  - `✅ 確認記錄` → callback `comm:confirm:<project_id>`
  - `🔄 重新生成` → callback `comm:regen:<project_id>`
- draft + client_message 存入 Redis（TTL 24h）

**新增 comm callback 處理（`comm:confirm` / `comm:regen`）**
- `confirm`：呼叫 `/log-reply`，清除 keyboard，發送確認訊息，提醒手動發送
- `regen`：重新呼叫 `/draft-reply`，發送新草稿（含新 keyboard）

---

### 修改：`docker-compose.yml`

- 新增 `comm-assistant` service（port 3009，volumes: ./projects）
- `telegram-bot` 環境變數新增 `COMM_ASSISTANT_URL=http://comm-assistant:3009`
- `telegram-bot` depends_on 新增 `comm-assistant`

---

## 重要限制（已遵守）

- 草稿**只記錄**到 `client-log.md`，不自動送出給客戶
- 需人工複製草稿手動發送
- 確認訊息明確提示「⚠️ 請記得手動將回覆發送給客戶」
