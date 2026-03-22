# Phase 2.1 — 實作 Agency OS 核心架構

- [x] 閱讀 `docs/specs/intake-module.md`、`docs/specs/dispatch-module.md`、`docs/specs/sdd-workflow.md` 了解完整技術規格<!-- note: TypeScript + Node.js 技術棧，src/modules/{intake,dispatch}/、src/utils/、src/types/、tests/、.dispatch/templates/ -->
- [x] 建立專案目錄結構（src/、docs/、tests/ 等依規格定義的骨架）<!-- note: src/modules/intake、src/modules/dispatch、src/utils、src/types、tests、.dispatch/templates -->
- [x] 實作核心設定模組（config、常數、型別定義）<!-- note: src/config.ts, src/types/intake.ts, src/types/dispatch.ts -->
- [x] 實作基礎工具函式（共用 helpers、logging、錯誤處理）<!-- note: src/utils/logger.ts, errors.ts, file-writer.ts, slug.ts -->
- [x] 建立 package.json / 專案初始化檔案（依規格決定技術棧）<!-- note: package.json (ESM, TypeScript 5.4, @anthropic-ai/sdk, handlebars, uuid, yaml), tsconfig.json -->
- [x] 確認核心骨架可正常啟動（不含業務邏輯），無語法錯誤<!-- note: tsc --noEmit passes with 0 errors -->
- [x] 將完成摘要與建立的檔案清單寫入 `.dispatch/tasks/implement-core/output.md`
