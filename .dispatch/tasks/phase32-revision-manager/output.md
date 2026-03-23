# Phase 3.2 — Revision Manager 完成摘要

## 建立檔案

| 檔案 | 說明 |
|------|------|
| `services/revision-manager/package.json` | Node.js 套件定義，依賴 express / pg / dotenv |
| `services/revision-manager/Dockerfile` | node:20-slim，EXPOSE 3007 |
| `services/revision-manager/server.js` | 主程式，實作所有端點 |

## API 端點

### GET /health
回傳 `{ status: "ok", service: "revision-manager", ts }`.

### POST /revision
**Body:** `{ project_id: number, feedback: string }`

**流程：**
1. 查 `projects` 表取得 `workspace_path`
2. 掃描 `{workspace_path}/revisions/` 目錄，計算下一個 NNN（padStart 3位）
3. 用換行 / 句號拆解 feedback → action_items
4. 寫入 `{workspace_path}/revisions/revision-NNN.md`（YAML frontmatter 格式）
5. INSERT `agent_logs`（agent_name=revision-manager, status=revision_created）
6. POST `{DEV_DISPATCHER_URL}/dispatch` 重新 dispatch 專案
7. 回傳 `{ created, project_id, revision_num, revision_file, action_items, dispatch_result }`

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | 3007 | 監聽埠 |
| `DB_URL` | — | PostgreSQL 連線字串 |
| `PROJECTS_ROOT` | `/projects` | 專案根目錄 |
| `DEV_DISPATCHER_URL` | `http://dev-dispatcher:3006` | dev-dispatcher 服務位址 |

## revision-NNN.md 格式範例

```yaml
---
revision: 001
project_id: 42
created_at: 2026-03-22T10:00:00.000Z
feedback: |
  請把按鈕顏色改成藍色。
  同時修正登入頁面的排版問題。
action_items:
  - 請把按鈕顏色改成藍色
  - 同時修正登入頁面的排版問題
---
```
