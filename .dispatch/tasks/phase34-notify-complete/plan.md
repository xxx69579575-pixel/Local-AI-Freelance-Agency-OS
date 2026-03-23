# Phase 3.4 — 客戶確認通知流程

- [x] 在 services/telegram-bot/ 新增 notify-complete.js
- [x] 實作 pollCompletedAgents()：輪詢 agent_logs WHERE status=completed AND notified=false
- [x] 組合 Telegram 訊息：專案名稱 + 交付摘要（output.md 前 200 字）+ inline keyboard（確認交付 / 需要修改）
- [x] 傳送通知並更新 agent_logs.notified=true
- [x] callback handler：「確認交付」→ UPDATE kanban_status='待最終確認'；「需要修改」→ POST revision-manager /revision
- [x] 從 services/telegram-bot/bot.js（或 index.js）引用 notify-complete，啟動輪詢
- [x] 寫入摘要至 .dispatch/tasks/phase34-notify-complete/output.md
