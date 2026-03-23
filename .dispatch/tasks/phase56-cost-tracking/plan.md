# Phase 5.6 — 成本追蹤

- [x] 讀取 services/scorer/ 與 services/comm-assistant/ 了解 Ollama 呼叫方式 <!-- scorer/server.js: /api/chat, ollamaData.eval_count / prompt_eval_count; no comm-assistant dir found -->
- [x] 新增 db/migrations/004_cost_tracking.sql：cost_logs 表（service、model、prompt_tokens、completion_tokens、cost_usd、created_at）
- [x] 在 scorer 與 comm-assistant 每次 Ollama 呼叫後寫入 cost_logs（token 數從回應取得，cost_usd 按 Ollama 本地=0 計算）<!-- logCost() fire-and-forget in /score and /quotation; comm-assistant dir 不存在，僅處理 scorer -->
- [x] 新增後端 GET /api/cost-summary：按 service/日期聚合，回傳累計 token 與費用
- [x] dashboard KPI 頁面新增成本摘要卡片（本月 token 數 + 估計費用）
- [x] 寫入摘要至 .dispatch/tasks/phase56-cost-tracking/output.md
