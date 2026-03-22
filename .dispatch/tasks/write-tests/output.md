# Phase 2.4 — 測試套件結果報告

## 執行摘要

- **日期**：2026-03-22
- **測試框架**：Jest 29 + ts-jest 29（ESM 模式，`--experimental-vm-modules`）
- **測試套件**：12 個（全數通過）
- **測試案例**：118 個（全數通過）
- **覆蓋率（整體）**：78.25% Statements / 73.36% Branches / 78.88% Functions

---

## 測試套件明細

| 套件 | 測試數 | 狀態 | 涵蓋驗收標準 |
|------|--------|------|-------------|
| `unit/intake/classifier.test.ts` | 7 | ✅ PASS | AC-03 |
| `unit/intake/risk-analyzer.test.ts` | 5 | ✅ PASS | AC-04 |
| `unit/intake/template.test.ts` | 10 | ✅ PASS | AC-02, AC-07 |
| `unit/intake/parser.test.ts` | 7 | ✅ PASS | AC-01, AC-06, AC-08 |
| `unit/intake/api.test.ts` | 7 | ✅ PASS | AC-05 |
| `unit/utils/slug.test.ts` | 17 | ✅ PASS | AC-06 (slug logic) |
| `unit/dispatch/plan-manager.test.ts` | 16 | ✅ PASS | plan.md 管理 |
| `unit/dispatch/ipc-manager.test.ts` | 13 | ✅ PASS | AC-04, AC-06, AC-07 |
| `unit/dispatch/command-parser.test.ts` | 10 | ✅ PASS | AC-08 |
| `unit/dispatch/task-runner.test.ts` | 14 | ✅ PASS | AC-01, AC-02, AC-03, AC-10 |
| `unit/dispatch/api.test.ts` | 9 | ✅ PASS | AC-02, AC-07, AC-08, AC-10 |
| `integration/intake-dispatch.test.ts` | 5 | ✅ PASS | AC-01, AC-03, AC-06, AC-07, AC-09 |

---

## 覆蓋率明細

| 模組 | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `dispatch/alias-registry.ts` | 100% | 100% | 100% | 100% |
| `dispatch/command-parser.ts` | 100% | 100% | 100% | 100% |
| `dispatch/plan-manager.ts` | 100% | 76% | 100% | 100% |
| `dispatch/ipc-manager.ts` | 91% | 92% | 89% | 93% |
| `dispatch/task-runner.ts` | 78% | 89% | 67% | 81% |
| `dispatch/api.ts` | 71% | 65% | 81% | 73% |
| `intake/classifier.ts` | 100% | 85% | 100% | 100% |
| `intake/risk-analyzer.ts` | 100% | 100% | 100% | 100% |
| `intake/template.ts` | 100% | 100% | 100% | 100% |
| `intake/parser.ts` | 100% | 65% | 100% | 100% |
| `intake/api.ts` | 84% | 73% | 88% | 84% |
| `utils/slug.ts` | 100% | 100% | 100% | 100% |
| `utils/errors.ts` | 85% | 100% | 80% | 85% |

---

## 技術筆記

**ESM Mock 解決方案**：本專案使用 Node ESM（`"type": "module"`）與 ts-jest。發現 `jest.mock()` 在 ESM 模式下未被正確 hoist（factory 在 static import 解析後才執行），導致 transitive import 無法攔截。解決方案：改用 `jest.unstable_mockModule()` + top-level `await import()` 動態載入，確保 mock 在 import 前完成註冊。

**測試架構**：
- 純函式（classifier、risk-analyzer、template、parsePlan 等）無需 mock，直接呼叫
- 有 I/O 的函式（markItemDone、runIntake 等）透過 `jest.unstable_mockModule` mock file-writer
- 整合測試使用 in-memory Map 模擬 file system，驗證完整工作流
