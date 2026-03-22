# Phase 2.1 — 核心架構實作完成摘要

**完成時間**：2026-03-22
**技術棧決策**：TypeScript 5.4 + Node.js ESM，依規格 § 4.1 資料結構與 § 4.3 元件設計

---

## 技術棧選擇說明

規格文件中所有資料結構均以 TypeScript interface 定義，AI 整合使用 `@anthropic-ai/sdk`（規格 § 4.4 指定 Claude API），Handlebars 模板引擎（規格 § 4.3 明確要求），UUID v4 用於 TaskRecord.id 與 intake slug fallback。

---

## 建立的檔案清單

### 專案根目錄
- `package.json` — 依賴宣告（@anthropic-ai/sdk, handlebars, uuid, yaml, tsx, ts-jest 等）
- `tsconfig.json` — TypeScript 設定（ESNext module, strict mode）

### src/
- `src/index.ts` — 應用程式入口

### src/config.ts
- 全域常數：模型 ID、路徑、IPC 逾時、AI 重試次數、dispatch alias 清單

### src/types/
- `src/types/intake.ts` — `IntakeInput`, `FeatureItem`, `RiskItem`, `NextAction`, `IntakeOutput`
- `src/types/dispatch.ts` — `TaskStatus`, `TaskRecord`, `IPCMessage`, `ChecklistItem`, `DispatchCommand`, `AliasEntry`

### src/utils/
- `src/utils/logger.ts` — 結構化 logger（debug/info/warn/error，尊重 LOG_LEVEL 環境變數）
- `src/utils/errors.ts` — `AgencyOSError`, `AIParseError`, `WaitingForInputError`, `InvalidAliasError`, `SpecGateError`
- `src/utils/file-writer.ts` — `atomicWrite`（Windows NTFS 相容）, `writeFile`, `readFile`, `fileExists`
- `src/utils/slug.ts` — `buildIntakeSlug`, `resolveIntakeSlug`, `buildDispatchSlug`, `resolveDispatchSlug`（含非 ASCII 處理、UUID fallback、碰撞解決）

### src/modules/intake/
- `src/modules/intake/index.ts` — 模組公開 API
- `src/modules/intake/parser.ts` — `runIntake()`（AI 分析 + 重試機制）
- `src/modules/intake/template.ts` — `buildMarkdown()`（YAML frontmatter + 七章節 Markdown）

### src/modules/dispatch/
- `src/modules/dispatch/index.ts` — 模組公開 API
- `src/modules/dispatch/alias-registry.ts` — 13 個 alias 對應表 + 驗證函式
- `src/modules/dispatch/command-parser.ts` — `/dispatch` 指令解析
- `src/modules/dispatch/plan-manager.ts` — checklist 讀寫（parsePlan, updateItem, serializePlan, markItem*）
- `src/modules/dispatch/ipc-manager.ts` — 事件驅動式 IPC（askAndPause, checkPendingAnswer, writeAnswer, isQuestionTimedOut）
- `src/modules/dispatch/template-engine.ts` — Handlebars 模板渲染
- `src/modules/dispatch/task-runner.ts` — 任務建立與狀態管理（in-memory store，Phase 2.3 加入持久化）

### .dispatch/templates/（13 個 Handlebars 模板）
intake-plan.md, write-spec-plan.md, review-spec-plan.md, update-spec-plan.md,
implement-plan.md, add-feature-plan.md, fix-bug-plan.md, write-tests-plan.md,
code-review-plan.md, qa-check-plan.md, security-plan.md, deploy-vercel-plan.md, summarize-plan.md

---

## 驗證結果

- `tsc --noEmit`：**0 errors** ✓
- 目錄骨架：符合規格 § 4.3 元件設計 ✓
- 型別定義：完整對應規格 § 4.1 資料結構 ✓

---

## Phase 2.2/2.3 後續工作

- intake 模組：`classifier.ts`（MVP 分類）、`risk-analyzer.ts`、`api.ts`（REST API）
- dispatch 模組：`api.ts`（REST API）、任務持久化（目前為 in-memory store）
- tests/ 目錄：各模組單元測試
