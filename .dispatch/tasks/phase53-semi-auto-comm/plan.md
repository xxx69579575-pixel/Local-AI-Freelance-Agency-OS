# Phase 5.3 — 半自動客戶溝通

- [x] 讀取 services/telegram-bot/ 與 services/scorer/ 了解現有架構
- [x] 新增 services/comm-assistant/server.js：POST /draft-reply { project_id, client_message } — Ollama 生成回覆草稿 (also POST /log-reply to append to client-log.md)
- [x] Telegram Bot 新增指令 /reply <project_id> <message>：觸發草稿生成，回傳草稿給用戶確認
- [x] 確認按鈕 → 將草稿寫入 projects/{id}/client-log.md（人工紀錄，不自動送出）
- [x] Dockerfile + package.json for comm-assistant
- [x] 寫入摘要至 .dispatch/tasks/phase53-semi-auto-comm/output.md
