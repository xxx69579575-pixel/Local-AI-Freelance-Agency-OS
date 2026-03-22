<!-- 版本：v1.0 | 撰寫日期：2026-03-22 -->

# SDD 工作流模組實作規格 — sdd-workflow-impl

> **文件版本**：v1.0
> **建立日期**：2026-03-22
> **方法論**：SDD（Spec-Driven Development）
> **對應 MVP**：Phase 5.2（修復 QA fail — sdd-workflow 模組 11 條 AC 全 fail）
> **參考文件**：
> - `docs/specs/sdd-workflow.md` v1.1（行為規格）
> - `docs/qa/2026-03-22-qa.md`（fail 根因分析）

---

## 1. 目標與範圍（Goals & Scope）

### 1.1 目標

本文件為 `src/modules/sdd/` 模組的**實作規格**，補充 `sdd-workflow.md` v1.1 所定義的行為規格，提供足以指導開發者從零建立整個 sdd 模組的詳細技術說明。

QA 報告（2026-03-22）發現 sdd-workflow.md 對應的 12 條 AC 中，11 條 [fail]、1 條 [skip]，根本原因為 `src/modules/sdd/` 目錄完全不存在，以下六個元件均未建立：

- `spec-gate.ts`
- `spec-parser.ts`
- `review-parser.ts`
- `version-manager.ts`
- `drift-checker.ts`
- `api.ts`

本規格的目標是提供足夠明確的實作指引，使開發者（或 dispatch worker）能完整建立上述元件，並通過全部 11 條 [fail] AC。

### 1.2 範圍（In Scope）

- `src/modules/sdd/` 目錄下六個元件的完整實作規格
- 每個元件的函數簽名、輸入/輸出、錯誤處理
- `/api/sdd/*` 路由掛載方式（與現有 `src/server.ts` 整合）
- 每條 AC 的測試策略（Jest 單元測試 + API 整合測試）

### 1.3 範圍外（Out of Scope）

- `sdd-workflow.md` v1.1 已定義的行為規格（不重複，僅引用）
- intake / dispatch 模組的修復（由其他任務處理）
- 前端 UI（Agency OS 目前為純 REST API）

---

## 2. 使用者故事（User Stories）

| ID | 角色 | 故事 | 驗收條件摘要 |
|----|------|------|-------------|
| US-01 | AI Worker | 執行 implement 任務前，我需要 Spec Gate 確認規格已就緒 | Spec Gate 5 項檢查全部通過才允許繼續 |
| US-02 | AI Worker | 呼叫 drift-check 後，我能知道哪些 AC 實作不符合規格 | 回應包含每條 AC 的 passed/failed 狀態與說明 |
| US-03 | Freelancer | 執行 update-spec 後，版本號自動遞增並加入 changelog | 文件版本號正確遞增，changelog 章節出現新紀錄 |
| US-04 | Freelancer | 查詢 GET /api/sdd/status 可知目前 SDD 流程進行到哪個 Phase | 回應 current_phase 與各 Phase 狀態正確 |
| US-05 | Developer | 整個 sdd 模組有對應的單元測試（coverage ≥ 80%） | Jest 執行通過，不含任何 skip |

---

## 3. 功能規格（Functional Spec）

### 3.1 元件職責總覽

| 元件 | 職責 | 對應 AC |
|------|------|---------|
| `spec-parser.ts` | 解析 Markdown 規格文件，提取版本號、章節清單、AC 表格 | AC-02, AC-03, AC-06, AC-11 |
| `review-parser.ts` | 解析 review 文件，提取問題清單與狀態 | AC-04, AC-05, AC-07 |
| `spec-gate.ts` | 執行 Spec Gate 5 項驗證，整合 spec-parser 與 review-parser | AC-01, AC-02, AC-03, AC-04, AC-05, AC-07, AC-12 |
| `version-manager.ts` | 版本號遞增、changelog 寫入、v2.0 IPC 確認流程 | AC-06 |
| `drift-checker.ts` | AI 分析 AC 與實作的對應關係，偵測規格漂移 | AC-09 |
| `api.ts` | 掛載 /api/sdd/* 路由，接收 HTTP 請求並呼叫對應元件 | AC-08 |

### 3.2 spec-parser.ts 功能

**parseVersion(content: string): string**
- 掃描文件前 50 行，找到 `> **文件版本**：v{major}.{minor}` 格式的行
- 提取版本號字串（如 `"v1.0"`, `"v1.1"`）
- 若未找到，回傳 `"v0.0"`（表示格式異常）

**parseRequiredSections(content: string): string[]**
- 掃描全文，尋找 `## {n}. ` 格式（阿拉伯數字）的二級標題
- 回傳找到的章節編號陣列（如 `["1", "2", "3", "4", "5"]`）
- 注意：僅回傳整數章節（`## 1.`, `## 2.`），不包含子章節（`### 1.1`）

**parseAcceptanceCriteria(content: string): AcEntry[]**
- 找到 `## 5.` 或 `## 5 ` 開頭的章節
- 解析其中的 Markdown 表格，提取每列的 AC-ID、條件、測試方式
- 回傳 `AcEntry[]`；若無 AC 章節，回傳空陣列

### 3.3 review-parser.ts 功能

**parseReviewIssues(content: string): ReviewIssue[]**
- 找到 `## 問題清單` 區塊
- 解析其中的 Markdown 表格，每列為一個 ReviewIssue
- 狀態欄位包含 `OPEN`（含大寫比對）則 status 為 `"OPEN"`；含 `RESOLVED` 則為 `"RESOLVED"`
- 若表格不存在，回傳空陣列（不拋錯）

**getOpenIssues(reviewPath: string): Promise\<ReviewIssue[]>**
- 讀取 reviewPath 檔案
- 呼叫 parseReviewIssues，過濾 status === "OPEN" 的問題
- 若檔案不存在，拋出 `ReviewFileNotFoundError`

### 3.4 spec-gate.ts 功能

見 `sdd-workflow.md` § 4.4 的完整實作邏輯（此處不重複）。

額外實作要點：
- **AC-12**：若 request body 中 `require_reviewed: false` 且 `caller_alias` 屬於實作類，API 層需在 response 中加入 `"warning": "require_reviewed forced to true for implementation alias"`
- **Gate 停止行為**：任何一項 check 失敗後，後續 check 仍**繼續執行**（除非先決條件不滿足，如檔案不存在時跳過版本解析），以便回傳完整的失敗報告

### 3.5 version-manager.ts 功能

**incrementVersion(currentVersion: string, bumpType: "minor" | "major"): string**
- `"minor"`: `v1.0` → `v1.1`，`v1.9` → `v1.10`
- `"major"`: `v1.x` → `v2.0`
- 輸入格式不符（如 `"v0.0"`）時拋出 `InvalidVersionError`

**updateSpecVersion(specPath: string, newVersion: string, changelogEntries: string[]): Promise\<void>**
- 讀取規格文件內容
- 替換 `> **文件版本**：v{old}` 為 `> **文件版本**：v{new}`
- 在文件末尾的 `## Changelog` 章節（若不存在則新增）插入新版本記錄
- Changelog 格式：`### {newVersion} — {YYYY-MM-DD}\n- {entry1}\n- {entry2}`
- 使用 `atomicWrite`（與 `file-writer.ts` 一致）確保原子性寫入

**detectMajorChange(oldContent: string, newContent: string): boolean**
- 比較舊版本與新版本的 AC 數量差異
- 若新增/移除的 AC 數量 ≥ 3，或 TypeScript interface 定義有結構性變更（欄位增減 ≥ 2），回傳 `true`
- 否則回傳 `false`

### 3.6 drift-checker.ts 功能

見 `sdd-workflow.md` § 4.5 的完整流程（此處不重複）。

額外實作要點：
- **summarizeImplementation(implPath: string)**：掃描 implPath 下所有 `.ts` 文件（不含測試檔 `*.test.ts`），提取：
  - 每個 `export function` / `export async function` / `export class` 的名稱與參數
  - 函數體中含有 HTTP 狀態碼（如 `400`, `404`, `500`）的行
  - 總長度限制 8000 token（超過時截斷並加入 `[TRUNCATED]` 標記）
- **API 回應**：必須包含 `analysis_method: "ai"` 與 `coverage_note` 欄位（AC-09 明確要求）

### 3.7 api.ts 路由定義

```
POST   /api/sdd/spec-gate           — runSpecGate()
GET    /api/sdd/status              — getSddStatus()
GET    /api/sdd/specs               — listSpecs()
POST   /api/sdd/drift-check         — runDriftCheck()
```

完整請求/回應格式見 `sdd-workflow.md` § 4.2。

**路由掛載**：在 `src/server.ts` 中，import sdd api 並掛載（與 dispatch、intake 模組相同模式）：

```typescript
import { sddRouter } from "./modules/sdd/api";
// 在 createServer() 內：
registerRouter(sddRouter);
```

---

## 4. 技術規格（Technical Spec）

### 4.1 資料結構（TypeScript Interface）

完整定義見 `sdd-workflow.md` § 4.1。本文件補充實作所需的額外型別：

```typescript
// spec-parser.ts 內部使用
interface AcEntry {
  id: string;           // "AC-01"
  condition: string;    // 條件描述
  test_method: string;  // 測試方式
}

// review-parser.ts
class ReviewFileNotFoundError extends Error {
  constructor(path: string) {
    super(`Review file not found: ${path}`);
    this.name = "ReviewFileNotFoundError";
  }
}

// version-manager.ts
class InvalidVersionError extends Error {
  constructor(version: string) {
    super(`Invalid version format: ${version}`);
    this.name = "InvalidVersionError";
  }
}

// drift-checker.ts 內部
interface DriftCheckPromptInput {
  ac_list: AcEntry[];
  impl_summary: string;
}

// api.ts — Spec Gate request body
interface SpecGateRequest {
  spec_slug: string;
  require_reviewed?: boolean;
  caller_alias?: string;
}

// api.ts — Drift Check request body
interface DriftCheckRequest {
  spec_slug: string;
  impl_path: string;
}
```

### 4.2 API 介面（完整端點定義）

見 `sdd-workflow.md` § 4.2（完整定義在彼處，此處不重複）。

補充錯誤回應格式（所有端點一致）：

```json
// 400 Bad Request（缺少必填欄位）
{ "status": "error", "message": "spec_slug is required" }

// 404 Not Found（規格文件不存在，但 spec-gate 回傳 200 with passed:false）
{ "status": "error", "message": "Implementation path not found: src/modules/foo/" }

// 500 Internal Server Error
{ "status": "error", "message": "Internal server error" }
```

### 4.3 元件設計（目錄結構）

```
src/
└── modules/
    └── sdd/
        ├── index.ts              # 匯出所有 public API
        ├── spec-gate.ts          # Spec Gate 驗證（依賴 spec-parser, review-parser）
        ├── spec-parser.ts        # Markdown 規格文件解析（無外部依賴）
        ├── review-parser.ts      # Review 文件解析（依賴 file-writer 的 readFile）
        ├── version-manager.ts    # 版本管理（依賴 file-writer 的 atomicWrite）
        ├── drift-checker.ts      # 漂移偵測（依賴 Anthropic SDK）
        └── api.ts                # REST API 路由（依賴上述所有元件）

tests/
└── modules/
    └── sdd/
        ├── spec-parser.test.ts
        ├── review-parser.test.ts
        ├── spec-gate.test.ts
        ├── version-manager.test.ts
        ├── drift-checker.test.ts
        └── api.test.ts
```

**依賴規則**：
- `spec-parser.ts` 和 `review-parser.ts`：不依賴其他模組元件，僅使用 Node.js `fs/promises`
- `spec-gate.ts`：依賴 `spec-parser.ts`、`review-parser.ts`
- `version-manager.ts`：依賴 `spec-parser.ts`、`src/utils/file-writer.ts`
- `drift-checker.ts`：依賴 `spec-parser.ts`、`@anthropic-ai/sdk`
- `api.ts`：依賴所有上述元件

### 4.4 測試策略

每個元件的測試檔案需覆蓋：

**spec-parser.test.ts**
- 正常情況：正確提取版本號 v1.0、v1.1、v2.0
- 正常情況：正確提取 5 個必要章節
- 邊界情況：缺少版本號 → 回傳 "v0.0"
- 邊界情況：只有 3 個章節 → 回傳 3 個（非 5 個）
- 邊界情況：含子章節（`### 1.1`）時不被計入頂層章節

**review-parser.test.ts**
- 正常情況：解析含 OPEN 問題的 review 文件
- 正常情況：解析全部 RESOLVED 的 review 文件
- 邊界情況：`getOpenIssues` 對不存在的路徑拋出 `ReviewFileNotFoundError`
- 邊界情況：缺少「問題清單」章節 → 回傳空陣列

**spec-gate.test.ts**
- AC-01：規格文件不存在 → passed: false, file_exists check 失敗
- AC-02：版本 v1.0 + require_reviewed=true → passed: false, version_reviewed check 失敗
- AC-03：缺少必要章節 → passed: false, required_sections check 失敗（含缺失章節清單）
- AC-04：review 文件不存在 → passed: false, review_file_exists check 失敗
- AC-05：review 含 OPEN 問題 → passed: false, open_issues check 失敗
- AC-07：全部 RESOLVED → passed: true
- AC-12：caller_alias="implement", require_reviewed=false → 強制執行 review 檢查 + 回傳 warning

**version-manager.test.ts**
- AC-06：v1.0 → v1.1 遞增，changelog 正確插入
- 邊界情況：v1.9 → v1.10（minor 跨 10）
- 邊界情況：v2.0 大版本升級（major bump）
- 邊界情況：無效版本格式 → 拋出 InvalidVersionError

**drift-checker.test.ts**（使用 mock Anthropic SDK）
- AC-09：mock AI 回傳 AC-05 不符合 → drifts 陣列含 AC-05，analysis_method="ai"，coverage_note 存在
- 正常情況：mock AI 回傳全部通過 → drifts 為空陣列

**api.test.ts**（整合測試，使用 supertest）
- POST /api/sdd/spec-gate 的 400（缺少 spec_slug）
- POST /api/sdd/spec-gate 的 200 passed/failed 情境
- GET /api/sdd/status 的 200 回應結構驗證
- AC-08：GET /api/sdd/status 回應的 phases 陣列含正確狀態
- POST /api/sdd/drift-check 的 400（缺少 impl_path）

---

## 5. 驗收標準（Acceptance Criteria）

| AC-ID | 條件 | 測試方式 |
|-------|------|---------|
| AC-01 | `spec-gate.ts` 建立後，`POST /api/sdd/spec-gate` 對不存在的規格回傳 `passed:false` 且 `file_exists.passed=false` | api.test.ts 傳入不存在的 spec_slug |
| AC-02 | 版本 v1.0 的規格文件透過 spec-gate 時，`version_reviewed.passed=false`，message 含「Run review-spec first」 | spec-gate.test.ts |
| AC-03 | 缺少任一必要章節時，`required_sections.passed=false`，message 列出缺失章節編號 | spec-gate.test.ts（移除 ## 3. 後執行） |
| AC-04 | review 文件不存在時，`review_file_exists.passed=false`，message 含「Run /dispatch 'review-spec' first」 | spec-gate.test.ts |
| AC-05 | review 文件含 OPEN 問題時，`open_issues.passed=false`，message 列出所有 OPEN 問題 ID | spec-gate.test.ts |
| AC-06 | `updateSpecVersion("v1.0", ["解決 RV-001"])` 後，文件版本號變為 v1.1，末尾出現 Changelog 章節含新記錄 | version-manager.test.ts |
| AC-07 | review 文件中所有問題 RESOLVED 後，`open_issues.passed=true` | spec-gate.test.ts |
| AC-08 | `GET /api/sdd/status` 回傳 `{ phases: [...], current_phase: string, blocked_phases: [...], completable_phases: [...] }` | api.test.ts 驗證 response schema |
| AC-09 | `POST /api/sdd/drift-check` 回應包含 `analysis_method: "ai"` 與 `coverage_note` 欄位；當 AI 識別到漂移時 `drifts` 非空 | drift-checker.test.ts（mock AI 回傳不符合結果） |
| AC-10 | spec-gate.test.ts 完整整合測試：v1.1 規格 + 全部 RESOLVED review → `passed: true` | spec-gate.test.ts 整合情境 |
| AC-11 | write-spec 生成的規格文件包含所有 5 個必要章節（由 spec-parser 驗證） | spec-parser.test.ts 解析實際 sdd-workflow.md |
| AC-12 | `POST /api/sdd/spec-gate { spec_slug, require_reviewed: false, caller_alias: "implement" }` 仍執行 review 相關 check，回應含 `warning` 欄位 | api.test.ts |

---

## Changelog

### v1.0 — 2026-03-22
- 初始版本，由 dispatch worker（write-spec-v2 任務）撰寫
- 背景：QA 報告 sdd-workflow 模組 11 條 AC 全 fail，`src/modules/sdd/` 完全未實作
- 本規格補充 sdd-workflow.md v1.1 缺少的實作層細節，使開發者可直接依此建立模組

---

*此規格文件由 dispatch worker（write-spec-v2 任務）自動生成。如有修訂請更新版本號並加入 changelog。*
