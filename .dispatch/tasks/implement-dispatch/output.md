# Phase 2.3 — 任務派遣與追蹤模組實作完成摘要

**完成時間**：2026-03-22
**規格版本**：dispatch-module.md v1.1
**TypeScript 型別檢查**：`tsc --noEmit` — **0 errors** ✓

---

## 實作內容

### 修改的檔案

#### `src/modules/dispatch/task-runner.ts`
- 新增 **File-based 持久化**：任務記錄存入 `.dispatch/tasks/tasks.json`
  - `loadTasks()` — 啟動時從磁碟載入
  - `saveTasks()` — 每次 mutation 後原子寫入（`atomicWrite`）
- 新增 **`stopTask(taskId)`**（§ 4.2 DELETE 端點，採納 RV-016）：
  - `running` / `waiting_input` → 停止，寫入 `context.md`（若有 context），回傳 `{ status: "stopped", context_saved: true }`
  - `pending` → 取消，刪除記錄，回傳 `{ status: "cancelled", context_saved: false }`
  - `done` / `failed` / `timed_out` → 刪除，回傳 `{ status: "deleted", context_saved: false }`
- 新增 `StopTaskResult` 型別介面
- `createTask`、`updateTaskStatus` 均觸發持久化

#### `src/modules/dispatch/ipc-manager.ts`
- 新增 **`readQuestion(taskSlug, seq)`** — 讀取原始 question 文件內容，供 API 層提取問題/截止時間

#### `src/modules/dispatch/index.ts`
- 更新 export 清單，加入：`loadTasks`、`stopTask`、`handleWaitingForInput`、`readQuestion`、`handleDispatchRequest`

### 新增的檔案

#### `src/modules/dispatch/api.ts`
依規格 § 4.2 實作全部 REST API 路由（Node.js 原生 `http` 模組，無外部框架依賴）：

| 端點 | 說明 |
|------|------|
| `POST /api/dispatch` | 解析 alias/context，建立任務，轉為 running 狀態，回傳 201 |
| `GET /api/dispatch/tasks` | 列出所有任務，含全部狀態統計（running/done/failed/timed_out/waiting_input/pending），支援 `?status=` / `?limit=` / `?offset=` |
| `GET /api/dispatch/tasks/:task_id` | 查詢單一任務，`waiting_input` 狀態時附帶 `pending_question`（掃描 IPC 目錄），自動偵測 deadline 逾時並轉為 `timed_out` |
| `POST /api/dispatch/tasks/:task_id/answer` | 原子寫入 `.answer` 文件（驗證非空，採納 RV-017），偵測逾時 |
| `DELETE /api/dispatch/tasks/:task_id` | 依狀態停止/取消/刪除任務（採納 RV-016） |

- 無效 alias → 400 + 有效 alias 清單（符合 AC-08）
- 導出 `handleDispatchRequest(req, res)` 供主伺服器掛載

---

## 驗收標準對應

| AC-ID | 狀態 | 說明 |
|-------|------|------|
| AC-01 | ✓ | `createTask` 建立 task 目錄與 plan.md |
| AC-02 | ✓ | `POST /api/dispatch` 建立後立即 `updateTaskStatus → running` |
| AC-03 | ✓ | plan-manager + task-runner 支援完整 done 流程 |
| AC-04 | ✓ | `askAndPause` + `handleWaitingForInput` + context.md 寫入 |
| AC-05 | ✓ | `writeAnswer` + `checkPendingAnswer` 事件驅動式 IPC |
| AC-06 | ✓ | `isQuestionTimedOut` + GET task 時自動偵測 |
| AC-07 | ✓ | `writeAnswer` 使用 `atomicWrite`，空值回 400 |
| AC-08 | ✓ | `InvalidAliasError` → 400 + 清單 |
| AC-09 | ✓ | 各任務隔離目錄（.dispatch/tasks/<slug>/） |
| AC-10 | ✓ | GET tasks 回傳含全部 6 種狀態計數 |

---

## 模組檔案清單

```
src/modules/dispatch/
├── index.ts            ✓（更新 exports）
├── command-parser.ts   ✓（既有，未修改）
├── task-runner.ts      ✓（新增持久化 + stopTask）
├── plan-manager.ts     ✓（既有，未修改）
├── ipc-manager.ts      ✓（新增 readQuestion）
├── alias-registry.ts   ✓（既有，未修改）
├── template-engine.ts  ✓（既有，未修改）
└── api.ts              ✓（新增）

src/types/dispatch.ts   ✓（既有型別完整，StopTaskResult 定義在 task-runner.ts）
```
