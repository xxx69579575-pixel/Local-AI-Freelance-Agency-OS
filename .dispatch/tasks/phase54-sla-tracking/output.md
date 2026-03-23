# Phase 5.4 — SLA 追蹤與版本管理 完成摘要

完成時間：2026-03-22

## 變更清單

### 1. `db/migrations/002_sla_tracking.sql`
- `projects` 表 ALTER：加 `due_date TIMESTAMPTZ`、`sla_hours INTEGER DEFAULT 72`、`version VARCHAR(20) DEFAULT '1.0.0'`
- `due_date` 建立 partial index 加速查詢

### 2. `services/dashboard/server.js`
- 新增 `GET /api/sla-status`
  - 查詢 `due_date IS NOT NULL` 且 status 不在 closed/cancelled 的專案
  - 回傳 `overdue`（hours_remaining ≤ 0）、`warning`（0–48h）清單
  - 含 `overdue_ids`、`warning_ids` 陣列供前端快速比對

### 3. `services/dashboard/public/kanban.html`
- 新增 `.sla-warning`（橙色左框）、`.sla-overdue`（紅色左框）CSS class
- 新增 `.sla-badge-warning`（橙色）、`.sla-badge-overdue`（紅色）badge 樣式
- 新增 `fetchSlaStatus()` 函式：每 30 秒更新 `slaOverdueIds`、`slaWarningIds`
- `renderCard()` 根據 SLA 狀態附加對應 class 與 badge
- 啟動時先 fetch SLA 再 render board 避免閃爍

### 4. `services/telegram-bot/sla-checker.js`（新檔案）
- `setInterval` 每小時執行一次掃描
- 首次偵測到專案逾期／警示時立即發送個別通知（process memory 防重複）
- 每日 09:00 之後首次執行時發送彙整通知
- 依賴環境變數：`DASHBOARD_URL`、`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`

## 啟動方式

### 執行 migration
```bash
psql -U <user> -d <db> -f db/migrations/002_sla_tracking.sql
```

### 啟動 sla-checker（在 telegram-bot 容器內）
在 `services/telegram-bot/bot.js` 或 Dockerfile CMD 中加：
```js
require('./sla-checker');
```
或獨立執行：
```bash
node services/telegram-bot/sla-checker.js
```

## API 範例回應

```json
GET /api/sla-status
{
  "overdue_count": 1,
  "warning_count": 2,
  "overdue": [{ "id": 5, "title": "專案A", "hours_remaining": -3.2, ... }],
  "warning": [{ "id": 7, "title": "專案B", "hours_remaining": 22.1, ... }],
  "overdue_ids": [5],
  "warning_ids": [7, 9]
}
```
