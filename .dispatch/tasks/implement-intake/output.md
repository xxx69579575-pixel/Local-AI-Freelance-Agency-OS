# Phase 2.2 — 客戶需求訪談模組實作完成摘要

**完成時間**：2026-03-22
**規格版本**：intake-module.md v1.1
**TypeScript 驗證**：`tsc --noEmit` — 0 errors ✓

---

## 新建檔案

### src/modules/intake/
- `src/modules/intake/classifier.ts` — `normalizeFeatures(mvpFeatures, niceToHaveFeatures)` 驗證並正規化 AI 輸出的功能項目（priority、phase、complexity enum 驗證；缺少 id/name 自動補填）
- `src/modules/intake/risk-analyzer.ts` — `normalizeRisks(risks)` 驗證並正規化 AI 輸出的風險項目（severity enum 驗證；缺少 id/description 自動補填）
- `src/modules/intake/api.ts` — REST API handler（Node.js 內建 `http` 模組）：`POST /api/intake`，實作規格 § 4.2 的 Web API；含 400 輸入驗證、500 錯誤處理

## 修改檔案

### src/modules/intake/
- `src/modules/intake/parser.ts` — 主要變更：
  1. **AC-06 覆蓋行為**：改用 `buildIntakeSlug`（不加碰撞後綴），同名專案直接覆蓋舊文件
  2. **RV-007 alias 驗證**：呼叫 `validateDispatchAlias()` 驗證 AI 生成的 `dispatch_alias`；無效值 fallback 為 `"write-spec"`
  3. **正規化整合**：呼叫 `normalizeFeatures()` 與 `normalizeRisks()` 後處理 AI 回應
- `src/modules/intake/index.ts` — 補充 export：`normalizeFeatures`、`normalizeRisks`、`createIntakeServer`

## 驗收標準確認

| AC-ID | 狀態 | 說明 |
|-------|------|------|
| AC-01 | ✓ | `runIntake()` 呼叫 `writeFile()` 建立 `docs/intake/<slug>.md` |
| AC-02 | ✓ | `template.ts` 生成 YAML frontmatter + 七個章節 |
| AC-03 | ✓ | `normalizeFeatures()` 確保 MVP 功能含必要欄位 |
| AC-04 | ✓ | `normalizeRisks()` 確保風險含 severity 與 mitigation |
| AC-05 | ✓ | `api.ts` 缺少 project_name 或 description 回傳 400 |
| AC-06 | ✓ | 改用 `buildIntakeSlug`（無碰撞後綴）直接覆蓋舊文件 |
| AC-07 | ✓ | `template.ts` 輸出含 YAML frontmatter（project_name、version、created_at、intake_slug） |
| AC-08 | ✓ | `parser.ts` 重試機制最多 3 次嘗試；失敗拋出 `AIParseError`，不寫入文件 |
| AC-09 | ✓ | 架構預留（IPC 由 dispatch-module 提供，CLI 觸發由 dispatch worker 處理） |

## 元件關係

```
api.ts (POST /api/intake)
    └── parser.ts (runIntake)
            ├── classifier.ts (normalizeFeatures)
            ├── risk-analyzer.ts (normalizeRisks)
            ├── alias-registry.ts (validateDispatchAlias)  ← dispatch module
            └── template.ts (buildMarkdown)
                    └── file-writer.ts (writeFile)
```
