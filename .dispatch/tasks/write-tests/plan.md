# Phase 2.4 — 撰寫測試套件 (write-tests)

- [x] 閱讀 `docs/specs/intake-module.md` 的驗收標準，與 `src/modules/intake/` 的實作<!-- AC-01~AC-09 確認完成 -->
- [x] 為 intake 模組撰寫單元測試（parser、classifier、risk-analyzer、api），覆蓋所有驗收標準<!-- AC-01~AC-09 -->
- [x] 閱讀 `docs/specs/dispatch-module.md` 的驗收標準，與 `src/modules/dispatch/` 的實作<!-- AC-01~AC-10 確認完成 -->
- [x] 為 dispatch 模組撰寫單元測試（task-runner、api、持久化），覆蓋所有驗收標準<!-- AC-01~AC-10 -->
- [x] 撰寫關鍵整合測試（intake → dispatch 工作流端對端）<!-- tests/integration/intake-dispatch.test.ts -->
- [x] 執行測試套件（`npm test` 或對應指令），確認所有測試通過<!-- 118/118 通過，12 個測試套件全數通過 -->
- [x] 將測試結果（通過/失敗數、覆蓋率）寫入 `.dispatch/tasks/write-tests/output.md`<!-- output.md 已寫入 -->
