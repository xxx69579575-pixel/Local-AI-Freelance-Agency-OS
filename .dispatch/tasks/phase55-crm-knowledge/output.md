# Phase 5.5 — CRM 與知識庫 完成摘要

## 完成日期
2026-03-22

## 新增 / 修改檔案

### 新建
| 檔案 | 說明 |
|------|------|
| `db/migrations/003_knowledge_base.sql` | knowledge_base 資料表 + GIN index on tags |
| `services/knowledge-base/package.json` | 新服務 metadata |
| `services/knowledge-base/Dockerfile` | Node 20-slim, port 3010 |
| `services/knowledge-base/server.js` | POST /learn、GET /suggest、GET /knowledge、GET /health |
| `services/dashboard/public/knowledge-base.html` | 知識庫瀏覽頁（分頁、標籤篩選、純 CSS 橫向 bar 統計）|

### 修改
| 檔案 | 說明 |
|------|------|
| `services/scorer/prompt.js` | 新增 `formatSimilarCases()`，將歷史案件注入 few-shot 區塊 |
| `services/scorer/server.js` | POST /score 前呼叫 `fetchSimilarCases()`（best-effort，不阻塞） |
| `services/bootstrapper/server.js` | 新增 `httpPost()` helper + `POST /complete` 端點（結案 → /learn） |
| `services/dashboard/server.js` | 新增 `KNOWLEDGE_BASE_URL` + `GET /api/knowledge`、`POST /api/knowledge/learn` proxy |
| `docker-compose.yml` | 新增 `knowledge-base` 服務（port 3010）；scorer/bootstrapper/dashboard 加入 `KNOWLEDGE_BASE_URL` env |

## 架構說明

```
結案流程
bootstrapper POST /complete
  → UPDATE projects.status = 'completed'
  → UPDATE leads.status = 'closed'
  → knowledge-base POST /learn   ← 非同步，失敗不影響主流程

評分流程
scorer POST /score
  → knowledge-base GET /suggest?tags=...  ← best-effort, timeout 5s
  → 將最多 3 筆相似案件注入 Ollama prompt（few-shot 範例）
  → Ollama /api/chat

知識庫查詢
GET /suggest?tags=t1,t2,t3
  → WHERE tags && ARRAY[...]   （PostgreSQL 陣列重疊 + GIN index）
  → ORDER BY 相符標籤數 DESC, created_at DESC
  → LIMIT 3

Dashboard 知識庫頁
http://localhost:3003/knowledge-base.html
  → GET /api/knowledge（proxy → knowledge-base:3010/knowledge）
  → 純 CSS 橫向 bar：won / lost / pending 佔比
  → 標籤篩選（點擊 chip 或輸入逗號分隔）
  → 分頁瀏覽（每頁 20 筆）
```

## API 端點總覽

### knowledge-base（port 3010）
| Method | Path | 說明 |
|--------|------|------|
| GET | /health | 健康檢查 |
| POST | /learn | 記錄學習資料 |
| GET | /suggest?tags= | 查詢相似案件（最多 3 筆）|
| GET | /knowledge | 分頁瀏覽（支援 outcome/tags 篩選）|

### bootstrapper（port 3005）新增
| Method | Path | 說明 |
|--------|------|------|
| POST | /complete | 結案 + 觸發 /learn |

### dashboard（port 3003）新增
| Method | Path | 說明 |
|--------|------|------|
| GET | /api/knowledge | proxy → knowledge-base /knowledge |
| POST | /api/knowledge/learn | proxy → knowledge-base /learn |
