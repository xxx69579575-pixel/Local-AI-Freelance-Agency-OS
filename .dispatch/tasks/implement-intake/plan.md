# Phase 2.2 — 實作客戶需求訪談模組 (intake-module)

- [x] 閱讀 `docs/specs/intake-module.md`（v1.1）與 `docs/tasks/implement-core/output.md` 了解核心架構 — 已確認骨架：index/parser/template 已存在，需補 classifier.ts、risk-analyzer.ts、api.ts，並依 AC-06 修正 parser.ts 覆蓋行為
- [x] 實作 `src/modules/intake/` 下的所有功能（intake form、需求收集介面、資料儲存） — 已建立 classifier.ts、risk-analyzer.ts、api.ts；更新 parser.ts（AC-06 覆蓋行為、RV-007 alias 驗證）；更新 index.ts
- [x] 確認型別定義與 `src/types/intake.ts` 一致，補充缺少的型別 — 型別完整，符合規格 § 4.1；無需補充
- [x] 確認模組可正確 import 核心 utils（logger、errors、file-writer） — 全部 import 正確
- [x] 執行 `tsc --noEmit`，確認無型別錯誤 — 0 errors ✓
- [x] 將完成摘要與建立的檔案清單寫入 `.dispatch/tasks/implement-intake/output.md`
