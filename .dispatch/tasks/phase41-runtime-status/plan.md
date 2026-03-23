# Phase 4.1 — Agent Runtime Status 面板

- [x] 讀取 services/dashboard/ 現有結構，了解前端框架與 API 架構（vanilla JS + Express，kanban.html + server.js）
- [x] 新增後端 GET /api/agent-status：健康檢查 n8n / Ollama / Telegram Bot / Dev Dispatcher / Revision Manager（各服務 HTTP /health）
- [x] 新增前端 AgentStatusPanel 元件：顯示各 agent 狀態（online/offline/error + 最後檢查時間）
- [x] 每 30 秒自動刷新（setInterval fetchAgentStatus, 30000）
- [x] 整合至 dashboard 主頁面（位於 KPI block 與看板之間）
- [x] 寫入摘要至 .dispatch/tasks/phase41-runtime-status/output.md
