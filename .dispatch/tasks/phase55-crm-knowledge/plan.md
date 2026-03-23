# Phase 5.5 — CRM 與知識庫

- [x] 讀取現有 DB schema、services/scorer/、services/bootstrapper/ 了解資料結構
- [x] 設計知識庫 schema：db/migrations/003_knowledge_base.sql（案件類型、技術標籤、成交價格區間、成功模式）
- [x] 實作 services/knowledge-base/server.js：POST /learn（結案後自動學習）、GET /suggest（評分時提供相似案件參考）
- [x] 更新 services/scorer/ 評分邏輯：呼叫 /suggest 取得歷史相似案件，作為 Ollama prompt 的 context
- [x] 新增 dashboard 頁面 knowledge-base.html：瀏覽已學習案件、標籤篩選、成功率統計
- [x] Project Bootstrapper 結案後自動呼叫 /learn（新增 POST /complete 端點）
- [x] 寫入摘要至 .dispatch/tasks/phase55-crm-knowledge/output.md
