# Phase 4.1 — Agent Runtime Status 面板 實作摘要

## 完成時間
2026-03-22

## 變更檔案

### `services/dashboard/server.js`
- 新增 `require('http')` (Node 內建，無需新增依賴)
- 新增 `AGENTS` 陣列：定義 5 個服務的名稱與健康檢查 URL
  - n8n → `http://n8n:5678/healthz`
  - Ollama → `http://ollama:11434/api/tags`
  - Telegram Bot → `http://telegram-bot:3002/health`
  - Dev Dispatcher → `http://dev-dispatcher:3006/health`
  - Revision Manager → `http://revision-manager:3007/health`
- 新增 `pingService(name, url)` 函式：
  - 每次 ping timeout = 3 秒
  - 回傳 `{ name, status, latency, http_code }`
  - status: `online` (2xx) / `error` (非 2xx) / `offline` (timeout/連線失敗)
- 新增 `GET /api/agent-status`：
  - 以 `Promise.allSettled` 並行發出所有 ping
  - 回傳 `{ agents: [...], checked_at: ISO8601 }`

### `services/dashboard/public/kanban.html`
- 新增 CSS：`.agent-status-panel`、`.agent-pill`、`.agent-dot`（dot-online/offline/error/unknown）
- 新增 HTML：`#agent-status-panel`（含 `#agent-pills` + `#agent-checked-at`），位於 KPI block 之後、看板之前
- 新增 JS：
  - `AGENT_LABELS` 映射（name → 顯示名稱）
  - `renderAgentPills(agents)` — 產生含狀態色點的 pill HTML
  - `fetchAgentStatus()` — fetch `/api/agent-status`，更新 DOM
  - 初始呼叫 + `setInterval(fetchAgentStatus, 30000)`

## 視覺狀態說明
| 狀態 | 顏色 | 說明 |
|------|------|------|
| online | 綠 (#22c55e) | HTTP 2xx 回應 |
| error  | 黃 (#f59e0b) | HTTP 非 2xx 回應 |
| offline | 紅 (#ef4444) | 連線失敗或 timeout (3s) |

## 注意事項
- 健康檢查使用 Docker 內部 DNS（容器名稱），需在 docker-compose 網路內才能解析
- 開發環境（非 Docker）所有 agent 會顯示 offline，屬預期行為
