# Phase 5.3 重構摘要

完成日期：2026-03-22
測試結果：**159/159 pass**（16 suites）

## 修復項目

### 警告-06：readBody() Buffer 串接
**檔案**：`src/modules/dispatch/api.ts`
**修改**：`let data = ""` + `data += chunk.toString()` → `const chunks: Buffer[]` + `chunks.push(chunk)` → `Buffer.concat(chunks).toString()`
**原因**：字串串接可能因 chunk 邊界切割多位元組字元造成 UTF-8 解碼錯誤；Buffer.concat 後統一解碼更正確。

### 警告-04：GET /tasks/:id timed_out 副作用封裝
**檔案**：`src/modules/dispatch/api.ts`
**修改**：新增 `maybeMarkTimedOut(taskId, pending_question)` private helper，GET handler 呼叫 helper 而非直接呼叫 `updateTaskStatus`。
**原因**：GET 語義應為唯讀，將寫入操作封裝在具名 helper 中，使測試與意圖更清晰。

### 警告-07：taskStore initialized 守衛
**檔案**：`src/modules/dispatch/task-runner.ts`
**修改**：加入模組層級 `let initialized = false`；`loadTasks()` 末尾及 `createTask()` 末尾設 `initialized = true`；`getTask()` / `listTasks()` 若 `!initialized` 則 `logger.warn` 並回傳 `undefined` / `[]`。
**原因**：防止伺服器啟動時在 `loadTasks()` 前存取 store 導致靜默資料遺失；`createTask` 也設 `initialized=true` 以支援測試（不需 disk load 的情境）。

### 警告-05：askAndPause() 設計意圖文件化
**檔案**：`src/modules/dispatch/ipc-manager.ts`
**修改**：在 JSDoc 加入說明，闡明 `WaitingForInputError` 只在 `atomicWrite` resolve 後才拋出，確保 question file 寫入與錯誤訊號同步。
**原因**：設計意圖不明顯，補充文件防止未來維護者誤解並加入不必要的 try/catch。

### 警告-02：parser.ts version="v1.0" 意圖說明
**檔案**：`src/modules/intake/parser.ts`
**修改**：`version: "v1.0"` 上方加入注解，說明此為 intake write-spec 輸出的初始版本，後續版本由 update-spec 透過 version-manager 遞增。
**原因**：硬寫字串看似未完成，注解明確說明此為規格定義的意圖行為。

## 不變項目
- 所有外部 API 行為不變
- 不新增功能
- 不修改型別定義
