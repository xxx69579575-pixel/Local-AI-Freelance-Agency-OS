# Phase 5.3 — 重構（依 code-review 建議）

- [ ] 閱讀 docs/reviews/2026-03-22-code-review.md，識別所有 [嚴重] 與 [警告] 問題
- [ ] 修復 [嚴重] 問題：version 遞增缺失（intake parser.ts）
- [ ] 修復 [警告] 問題：消除 readBody 重複實作（intake 與 dispatch API 中的重複邏輯）
- [ ] 修復 [警告] 問題：alias 雙重維護問題（alias-registry.ts 與 config 的同步邏輯）
- [ ] 修復 [警告] 問題：slug 碰撞精度（增加隨機位元組長度）
- [ ] 執行 `tsc --noEmit` 確認無型別錯誤
- [ ] 執行測試套件確認 118/118 仍全過
- [ ] 將重構摘要（修改檔案清單、diff 摘要）寫入 `.dispatch/tasks/refactor/output.md`
