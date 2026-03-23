# Phase 4.3 — KPI 區塊 完成摘要

## 實作項目

### 後端 `services/dashboard/server.js`
- 新增 `GET /api/kpi` endpoint
- 並行執行 4 條 SQL 查詢（Promise.all）
- 轉換率：`deals_won / quotes_sent * 100`，除以零時回傳 0
- 回傳 JSON: `{ new_leads, ai_recommended, quotes_sent, deals_won, conversion_rate }`

### 前端 `services/dashboard/public/kanban.html`
- `#kpi-block`：5 張輕量卡片，header 與 board 之間（頂部）
- 每張卡片：label（大寫小字）+ value（大數字，各自顏色強調）
  - 新案件 (30天)：紫色
  - AI 推薦：青色
  - 報價數 (30天)：黃色
  - 成交數：綠色
  - 轉換率：橙色（附 `%` 單位）
- `fetchKpi()` 函數：靜默失敗，不影響 Kanban 載入
- 與 Kanban 同步：頁面載入時執行，每 30 秒自動刷新

## 檔案異動
- `services/dashboard/server.js` — 新增 `/api/kpi` route
- `services/dashboard/public/kanban.html` — 新增 KpiBlock 樣式、HTML、JS
