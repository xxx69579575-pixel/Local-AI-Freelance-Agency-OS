# Phase 1.10 Output — Kanban Dashboard

## 完成項目

| 檔案 | 說明 |
|------|------|
| `services/dashboard/package.json` | Node 20 服務，依賴 express + pg + dotenv |
| `services/dashboard/Dockerfile` | node:20-slim，EXPOSE 3003 |
| `services/dashboard/server.js` | Express API：GET /api/kanban、GET /api/kanban/:status、GET /（靜態） |
| `services/dashboard/public/kanban.html` | 純 Vanilla JS + inline CSS Kanban 看板，14 欄，30s 自動刷新 |
| `docker-compose.yml` | 新增 `dashboard` service，port 3003，depends_on postgres |

## API 規格

### GET /api/kanban
回傳所有 14 個狀態的案件，格式：
```json
{
  "new": { "count": 2, "leads": [{ "id", "title", "source", "risk_score", "fit_score", "profit_score", "scraped_at" }] },
  "scoring": { "count": 0, "leads": [] },
  ...
}
```

### GET /api/kanban/:status
回傳單一狀態的案件列表。

### GET /
服務 `public/kanban.html`。

### GET /health
健康檢查。

## Kanban 欄位對照

| status key | 繁體中文標籤 |
|---|---|
| new | 新案件 |
| scoring | AI 評估中 |
| pending_decision | 待你決策 |
| rejected | 已拒絕 |
| pending_quote | 待報價 |
| quoted | 已送報價 |
| negotiating | 商談中 |
| negotiation_abandoned | 商談放棄 |
| won | 已成交 |
| in_development | 開發中 |
| pending_review | 待初審 |
| in_revision | 待修正 |
| pending_final | 待最終確認 |
| closed | 已結案 |

## 啟動方式

```bash
docker compose up -d dashboard
# 瀏覽 http://localhost:3003
```

## 設計決策

- **唯讀**：Dashboard 僅查詢，不提供任何 PATCH/PUT/DELETE，所有狀態變更透過 Telegram Bot。
- **無前端建構步驟**：Vanilla JS + inline CSS，直接 serve 靜態 HTML。
- **profit_score 別名**：DB 欄位 `expected_profit_score` 在 API 回應中以 `profit_score` 回傳（SQL alias）。
