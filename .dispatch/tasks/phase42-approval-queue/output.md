# Phase 4.2 — Human Approval Queue 完成摘要

完成日期：2026-03-22

## 實作內容

### 後端（`services/dashboard/server.js`）

新增 `express.json()` middleware 以支援 PATCH 請求 body。

新增 5 個 API 端點：

| 端點 | 功能 |
|------|------|
| `GET /api/approval-queue` | 查詢所有待審核項目，按優先序合併：報價(1) > 專案初審(2) > agent 派工(3) |
| `PATCH /api/quotations/:id/approve` | 核准報價草稿，更新 `quotations.approved_at`、`leads.status → quoted` |
| `PATCH /api/quotations/:id/reject` | 退回報價，在 `agent_logs` 寫入 `quotation_rejected` 供 revision-manager 偵測 |
| `PATCH /api/projects/:id/review` | 核准專案初審，`projects.status + leads.status → in_development` |
| `PATCH /api/projects/:id/reject` | 退回專案，`status → in_revision`，並在 `revisions` 表自動建立下一個 revision 記錄 |

查詢來源：
- `quotations WHERE approved_at IS NULL`（待審核報價）
- `projects WHERE status = 'pending_review'`（待初審專案）
- `agent_logs WHERE action='dispatch' AND status='success' LIMIT 20`（待確認派工）

所有狀態修改均使用 transaction 保持 `projects` 與 `leads` 同步。

### 前端（`services/dashboard/public/`）

**新增 `approval-queue.html`**：
- 獨立審核頁面，分三區塊顯示：報價審核 / 專案初審 / Agent 派工確認
- 每項目顯示類型、標題、來源/客戶、時間戳
- 報價草稿可展開預覽 `draft_content`
- 「確認」按鈕直接呼叫 approve API 並移除該列
- 「退回修改」展開 textarea 輸入修改意見後送出
- Toast 通知操作結果
- 每 30 秒自動刷新

**修改 `kanban.html`**：
- Header 加入「人工審核佇列」導航連結
- 連結旁顯示橙色 badge，每 30 秒呼叫 `/api/approval-queue` 更新待審核數量

## 資料庫影響

- 只讀：`quotations`、`projects`、`leads`、`agent_logs`
- 寫入：`quotations.approved_at`、`projects.status`、`leads.status`、`revisions`（新增）、`agent_logs`（reject 紀錄）
- 觸發器 `trg_leads_status_log` 自動記錄狀態變更至 `kanban_status`

## 限制說明

- `quotations` 表無獨立 `status` 欄位，以 `approved_at IS NULL` 作為 pending 判斷
- 拒絕報價不更改 lead status（讓使用者決定是否重新生成報價草稿）
- agent_dispatch 確認為前端純 UI 操作（移除項目），無後端持久化狀態
