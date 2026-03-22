# Phase 5.3 — 重構（不改變外部行為）

- [x] 讀取 docs/progress/2026-03-22-summary.md「中優先技術債」章節，確認重構範圍
- [x] 讀取 src/modules/dispatch/api.ts、src/modules/dispatch/task-runner.ts、src/modules/dispatch/ipc-manager.ts、src/modules/intake/parser.ts
- [x] 修復警告-06：dispatch/api.ts readBody() 改用 Buffer 陣列收集 chunks 再 Buffer.concat()，避免字串串接的編碼問題
- [x] 修復警告-04：dispatch/api.ts GET /tasks/:id 的 timed_out 副作用（第168-173行）— 抽為 maybeMarkTimedOut(taskId, pending_question) helper；GET handler 呼叫 helper，不直接呼叫 updateTaskStatus
- [x] 修復警告-07：task-runner.ts 加入 initialized flag；loadTasks() 和 createTask() 末尾設 initialized=true；getTask()/listTasks() 若 !initialized 則 logger.warn 並回傳 undefined/[]
- [x] 修復警告-05：ipc-manager.ts askAndPause() 加入 JSDoc 說明 WaitingForInputError 只在 atomicWrite 成功後才拋出的設計意圖
- [x] 修復警告-02：intake/parser.ts version="v1.0" 上方加入注解，說明此為初始版本意圖行為，後續由 update-spec 遞增
- [x] 執行完整測試套件：159 tests pass（16 suites）
- [x] 寫入重構摘要至 .dispatch/tasks/phase-5-3-refactor/output.md
