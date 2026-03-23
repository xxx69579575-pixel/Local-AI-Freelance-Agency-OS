# Phase 4.2 — Human Approval Queue

- [x] 讀取現有 dashboard 結構與 DB schema（leads、quotations、agent_logs）
- [x] 新增後端 GET /api/approval-queue：查詢所有需人工確認項目（pending 報價、pending revision、dispatched agent logs）
- [x] 新增前端 ApprovalQueue 元件：列表顯示待確認項目（類型、專案、時間戳、動作按鈕）
- [x] 實作「確認」/「拒絕」按鈕：呼叫對應後端 API（quotation approve、revision approve）
- [x] 整合至 dashboard 主頁面（Kanban 旁側欄或獨立 tab）— 新增 nav link + badge 計數器
- [x] 寫入摘要至 .dispatch/tasks/phase42-approval-queue/output.md
