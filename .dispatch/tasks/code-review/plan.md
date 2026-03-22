# Phase 3.1 — 程式碼審查 (code-review)

- [x] 審查 `src/modules/intake/` 所有檔案（正確性、邏輯錯誤、邊界情況）<!-- 已審查 parser.ts、classifier.ts、risk-analyzer.ts、template.ts、api.ts、index.ts -->
- [x] 審查 `src/modules/dispatch/` 所有檔案（正確性、邏輯錯誤、邊界情況）<!-- 已審查 api.ts、alias-registry.ts、command-parser.ts、ipc-manager.ts、plan-manager.ts、task-runner.ts、template-engine.ts、index.ts -->
- [x] 審查 `src/utils/` 與 `src/types/`（共用基礎設施品質）<!-- 已審查 logger.ts、errors.ts、file-writer.ts、slug.ts；types/intake.ts、types/dispatch.ts -->
- [x] 對照 `docs/specs/` 確認實作符合規格（不超出、不遺漏）<!-- 規格矩陣完成，發現 AC-09 未實作、模型規格衝突、version 遞增缺失 -->
- [x] 檢查效能瓶頸、可維護性問題（命名、重複邏輯、結構）<!-- 發現 readBody 重複實作、alias 雙重維護、slug 碰撞精度問題 -->
- [x] 輸出結構化審查報告到 `docs/reviews/2026-03-22-code-review.md`（嚴重/警告/建議三級）<!-- 1 嚴重、7 警告、8 建議，共 16 項 -->
- [x] 將完成摘要寫入 `.dispatch/tasks/code-review/output.md`<!-- 完成 -->
