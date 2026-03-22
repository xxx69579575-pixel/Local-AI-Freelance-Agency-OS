# Phase 3.2 — QA 驗收檢查 (qa-check)

- [x] 閱讀 `docs/specs/intake-module.md`（v1.1）所有驗收標準（AC-01~AC-09）<!-- note: 完整讀取 v1.1，9條AC已識別 -->
- [x] 逐條對照驗收標準，檢查 `src/modules/intake/` 實作：標注 [pass] / [fail] / [skip]<!-- note: pass:6 fail:3(AC-03,04,09) -->
- [x] 閱讀 `docs/specs/dispatch-module.md`（v1.1）所有驗收標準（AC-01~AC-10）<!-- note: 完整讀取 v1.1，10條AC已識別 -->
- [x] 逐條對照驗收標準，檢查 `src/modules/dispatch/` 實作：標注 [pass] / [fail] / [skip]<!-- note: pass:6 fail:2(AC-04,06*) skip:2(AC-03,05,09) -->
- [x] 閱讀 `docs/specs/sdd-workflow.md`（v1.1）驗收標準，驗證整體工作流符合規格<!-- note: sdd模組完全未實作，12條AC全部fail -->
- [x] 輸出 QA 報告到 `docs/qa/2026-03-22-qa.md`，列出需修復的 [fail] 項目清單<!-- note: 報告已生成，31條AC總計：pass:12 fail:15 skip:4 -->
- [x] 將完成摘要寫入 `.dispatch/tasks/qa-check/output.md`<!-- note: 完成 -->
