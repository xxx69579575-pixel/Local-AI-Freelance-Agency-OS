<!-- 版本：v1.1 | 更新日期：2026-03-22 -->
<!-- Changelog：
- 解決審查問題 RV-018（阻擋）：修正 Spec Gate 4.4 實作—require_reviewed=true 時 review 文件不存在應導致 Gate 失敗
- 解決審查問題 RV-019（阻擋）：定義 drift-check 實作機制（AI 分析策略 + 輸入格式 + 已知限制）
- 解決審查問題 RV-020、RV-021（警告）：釐清 review-spec 人工介入邊界；限制 require_reviewed=false 適用範圍
- 解決審查問題 RV-024、RV-025（跨模組警告）：定義 spec-parser 支援的標題格式；write-spec 讀取 intake 文件的協議移至 intake-module.md
- 採納建議 RV-022：定義 GET /api/sdd/status 的 current_phase 推導演算法
- 採納建議 RV-023：定義 v2.0 大版本升級的 IPC 確認流程
- [待議] RV-026：MVP 主列表由 ROADMAP.md 補充，不在本規格文件範圍內
-->

# SDD 工作流整合規格文件 — sdd-workflow

> **文件版本**：v1.1
> **建立日期**：2026-03-22
> **更新日期**：2026-03-22
> **方法論**：SDD（Spec-Driven Development）
> **對應 MVP**：貫穿 Phase 1–5 全流程

---

## 1. 目標與範圍（Goals & Scope）

### 1.1 目標

定義 Local AI Freelance Agency OS 的 SDD（規格驅動開發）完整工作流，確保：

1. **規格先行**：任何程式碼實作前，必須有完整且通過審查的規格文件
2. **可追蹤性**：每個實作決策都能追溯至對應規格
3. **迭代閉環**：從需求到部署形成閉環，支援多輪迭代
4. **AI 協作**：整個流程透過 `/dispatch` 指令由 AI worker 執行，人工只在關鍵節點介入

### 1.2 範圍（In Scope）

- SDD 完整流程定義（Phase 1–5 的執行順序與依賴關係）
- 各 Phase 的輸入/輸出文件規範
- Spec Gate（規格把關）機制：禁止在沒有規格的情況下實作
- 規格版本控制規範（版本號、changelog）
- 規格審查（review）與修訂（update）流程
- AI worker 與人工介入點的邊界定義

### 1.3 範圍外（Out of Scope）

- 具體程式碼實作（各模組有獨立規格文件）
- CI/CD 流水線設定（屬 Phase 4 部署範疇）
- 非 Markdown 格式的規格（所有規格必須為 Markdown）

---

## 2. 使用者故事（User Stories）

| ID | 角色 | 故事 | 驗收條件摘要 |
|----|------|------|-------------|
| US-01 | Freelancer | 我想遵循固定的 SDD 流程，確保每次開發都有規格依據，不會憑感覺寫程式 | 系統在 Phase 2 開始前強制檢查 specs/ 是否存在 |
| US-02 | Freelancer | 我想讓 AI 自動執行大部分流程，只在需要我決策時才打斷我 | 每個 Phase 只有明確的人工介入點，其餘自動執行 |
| US-03 | Freelancer | 我想知道目前規格文件的版本，以及每次修訂的原因 | 每份規格含版本號與 changelog |
| US-04 | AI Worker | 實作前我需要確認規格文件存在且版本已通過審查 | Spec Gate 驗證通過後才能啟動 implement |
| US-05 | AI Reviewer | 我需要一個標準格式來報告規格的問題（模糊、矛盾、遺漏） | review 文件使用統一的問題分類格式 |

---

## 3. 功能規格（Functional Spec）

### 3.1 SDD 完整流程圖

```
Phase 1：規格準備
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1.1 /dispatch "intake"
      輸入：客戶需求描述
      輸出：docs/intake/<slug>.md（含背景、MVP、風險）

  1.2 /dispatch "write-spec"
      輸入：docs/intake/<slug>.md
      輸出：docs/specs/<module>.md（含 US、功能規格、技術規格、AC）

  1.3 /dispatch "review-spec"
      輸入：docs/specs/*.md
      輸出：docs/specs/review/<module>-review.md（問題清單）

  1.4 /dispatch "update-spec"
      輸入：docs/specs/review/*.md + docs/specs/*.md
      輸出：docs/specs/*.md（更新版本號、解決所有問題）

  ↓ [SPEC GATE] — 所有規格版本 ≥ v1.1，無未解決審查問題

Phase 2：開發實作
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2.1 /dispatch "implement: docs/specs/agency-os.md"
      輸入：通過 Spec Gate 的規格文件
      輸出：src/（核心架構）

  2.2~2.5 [開發各模組、撰寫測試、修復 bug]

  ↓ [REVIEW GATE] — 所有測試通過，無 lint 錯誤

Phase 3：審查與 QA
Phase 4：部署
Phase 5：迭代維護（重新進入 Phase 1.1）
```

### 3.2 Spec Gate（規格把關）機制

**定義**：`implement`、`add-feature` 等實作類 alias 在啟動前，必須通過 Spec Gate 驗證。

**驗證條件**（全部滿足才能通過）：

1. `docs/specs/<target-module>.md` 文件存在
2. 文件版本號 ≥ `v1.1`（表示已經過至少一輪審查修訂）
3. 對應的 `docs/specs/review/<target-module>-review.md` **存在**（有過審查記錄）
4. review 文件中沒有狀態為 `OPEN` 的問題

> **RV-018 解決**：條件 3 為強制檢查。若 review 文件不存在，Spec Gate **必定失敗**（不論 `require_reviewed` 參數值為何，只要 alias 類型為實作類）。詳見 § 4.4 修正後的實作邏輯。

> **RV-021 解決**：`require_reviewed: false` 僅允許用於以下非實作類 alias：`review-spec`、`write-spec`、`update-spec`、`intake`、`summarize`。實作類 alias（`implement`、`add-feature`、`fix-bug`）呼叫 Spec Gate 時，`require_reviewed` 強制為 `true`，API 層面忽略傳入的 `false` 值並記錄警告。

**Spec Gate 失敗行為**：

```
Spec Gate FAILED: docs/specs/intake-module.md 版本為 v1.0（需 ≥ v1.1）
請先執行：/dispatch "review-spec" → /dispatch "update-spec"
```

任務停止，不建立 plan.md，不啟動 worker。

### 3.3 規格文件結構規範

所有 `docs/specs/*.md` 必須遵循統一結構：

```markdown
# [模組名稱] 規格文件 — [module-slug]

> **文件版本**：v1.0
> **建立日期**：YYYY-MM-DD
> **方法論**：SDD（Spec-Driven Development）
> **對應 MVP**：[MVP 編號]

---

## 1. 目標與範圍（Goals & Scope）
### 1.1 目標
### 1.2 範圍（In Scope）
### 1.3 範圍外（Out of Scope）

## 2. 使用者故事（User Stories）
[表格：ID | 角色 | 故事 | 驗收條件摘要]

## 3. 功能規格（Functional Spec）
[詳細功能描述]

## 4. 技術規格（Technical Spec）
### 4.1 資料結構（TypeScript interface）
### 4.2 API 介面（完整端點定義）
### 4.3 元件設計（目錄結構）

## 5. 驗收標準（Acceptance Criteria）
[表格：AC-ID | 條件 | 測試方式]
```

**Spec Gate 掃描的必要章節**：1、2、3、4、5（缺任何一個視為不完整規格，Gate 失敗）。

> **RV-024 解決（跨模組）**：`spec-parser.ts` 必須支援以下兩種章節標題格式：
> - **阿拉伯數字格式**（規格文件本身）：`## 1. 目標與範圍`、`## 2. 使用者故事` ...
> - **中文數字格式**（intake 輸出文件）：`## 一、專案背景摘要`、`## 二、MVP 功能清單` ...
>
> 章節存在性掃描時，`spec-parser.ts` 優先匹配 `## \d+\.` 格式；若未匹配，嘗試 `## [一二三四五六七八九十]、` 格式。Spec Gate 僅對 `docs/specs/*.md`（阿拉伯數字格式）執行必要章節檢查。

### 3.4 規格版本控制規範

版本號格式：`v<major>.<minor>`

| 版本 | 意義 | 觸發時機 |
|------|------|---------|
| `v1.0` | 初始版本 | `write-spec` 輸出 |
| `v1.1` | 第一次審查後修訂 | `update-spec` 後 |
| `v1.x` | 後續修訂 | 每次 `update-spec` 小版本 +1 |
| `v2.0` | 重大架構變更 | 需人工確認，大版本 +1 |

> **RV-023 採納**：`v2.0` 大版本升級需透過 IPC 確認流程：
> 1. `update-spec` worker 偵測到重大架構變更時（判斷標準：影響 3 個以上 AC 或改變核心資料結構），透過 IPC 提問：「本次修訂屬重大架構變更，是否升級為 v2.0？（回答 yes/no）」
> 2. 用戶回答 `yes`：版本升級為 `v2.0`，changelog 標記為重大變更
> 3. 用戶回答 `no` 或逾時：版本僅遞增 minor（`v1.x`）

每次版本更新必須在文件末尾加入 changelog：

```markdown
---

## Changelog

### v1.1 — 2026-03-25
- 解決 review 問題 RV-001：補充 API 錯誤回應格式
- 解決 review 問題 RV-002：澄清 slug 生成規則中的特殊字元處理

### v1.0 — 2026-03-22
- 初始版本，由 write-spec 任務生成
```

### 3.5 Review 文件格式規範

`docs/specs/review/<module>-review.md` 必須包含：

```markdown
# [模組名稱] 規格審查報告

> **審查版本**：v1.0
> **審查日期**：YYYY-MM-DD
> **審查者**：[dispatch worker / 模型]

## 問題清單

| RV-ID | 章節 | 問題類型 | 問題描述 | 嚴重度 | 狀態 |
|-------|------|---------|---------|-------|------|
| RV-001 | 4.2 API 介面 | 模糊 | 未定義 400 錯誤的回應 body 格式 | 高 | OPEN |
| RV-002 | 3.5 Slug | 矛盾 | Slug 規則說移除特殊字元，但範例中保留了數字 | 中 | OPEN |

## 問題類型定義
- **模糊**：描述不夠清晰，實作者需猜測
- **矛盾**：文件內部前後不一致
- **遺漏**：有明顯缺失，如未定義錯誤處理
- **過度設計**：要求超出 MVP 範圍

## 整體評估
[審查者的總結評語]
```

`update-spec` 完成後，將 OPEN 問題標記為 `RESOLVED`：

```markdown
| RV-001 | 4.2 API 介面 | 模糊 | ... | 高 | RESOLVED (v1.1) |
```

### 3.6 人工介入點（Manual Touchpoints）

以下是整個 SDD 流程中明確需要人工確認的節點：

| 介入點 | Phase | 觸發條件 | 人工行動 |
|-------|-------|---------|---------|
| 需求確認 | 1.1 | intake 生成後 | 確認 MVP 清單是否正確反映需求 |
| 審查結果確認 | 1.3 | review 文件生成後 | 確認審查發現的問題是否為真實問題（非誤報） |
| 修訂確認 | 1.4 | update-spec 後 | 確認所有問題已解決，可進入 Phase 2 |
| 架構決策 | 2.1 | implement 前 | 確認技術棧選擇（框架、DB 等）|
| QA 審核 | 3.2 | qa-check 後 | 確認所有 AC 通過，批准部署 |
| 部署確認 | 4.2 | deploy-vercel 前 | 最終確認生產環境部署 |

非介入點（AI 自動執行，無需人工確認）：

- **review-spec 文件生成**（AI 自動執行審查）
- write-spec、update-spec 的文件生成
- write-tests、run-tests 的測試執行
- 文件格式驗證（Spec Gate）

> **RV-020 解決**：釐清 review-spec 在上表中的邊界：
> - **「review-spec 文件生成」**（AI 執行 review-spec dispatch，輸出 review 文件）→ **無需人工確認**，屬非介入點
> - **「審查結果確認」**（人工檢查 AI 審查報告，判斷哪些問題是誤報）→ **需要人工確認**，屬介入點
>
> 兩者不同：前者是執行動作，後者是判斷結果。

---

## 4. 技術規格（Technical Spec）

### 4.1 資料結構

```typescript
// SpecDocument — 規格文件元數據
interface SpecDocument {
  slug: string;              // 文件 slug，對應檔名
  path: string;              // 相對路徑
  version: string;           // "v1.0", "v1.1", ...
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
  sections: SpecSection[];   // 文件中的章節
  review?: ReviewDocument;   // 關聯的審查文件
}

// SpecSection — 規格文件章節
interface SpecSection {
  id: string;                // "1", "1.1", "2", ...
  title: string;             // 章節標題
  required: boolean;         // 是否為必要章節（Spec Gate 用）
  word_count: number;        // 字數（品質指標）
}

// ReviewDocument — 審查文件
interface ReviewDocument {
  spec_slug: string;         // 對應的規格文件 slug
  reviewed_version: string;  // 審查的規格版本
  reviewed_at: string;       // ISO 8601
  issues: ReviewIssue[];
}

// ReviewIssue — 審查問題
interface ReviewIssue {
  id: string;                // "RV-001", "RV-002", ...
  section: string;           // 對應章節（如 "4.2"）
  type: "ambiguous" | "contradiction" | "missing" | "over-engineering";
  description: string;
  severity: "high" | "medium" | "low";
  status: "OPEN" | "RESOLVED";
  resolved_in?: string;      // 解決版本（如 "v1.1"）
}

// SpecGateResult — Spec Gate 驗證結果
interface SpecGateResult {
  passed: boolean;
  spec_path: string;
  version: string;
  checks: SpecGateCheck[];
}

// SpecGateCheck — 單項驗證結果
interface SpecGateCheck {
  name: string;              // 檢查名稱
  passed: boolean;
  message: string;           // 失敗時的說明
}

// SDDPhaseStatus — SDD 流程各 Phase 狀態
interface SDDPhaseStatus {
  phase: string;             // "1.1", "1.2", ...
  status: "not_started" | "in_progress" | "done" | "blocked";
  input_ready: boolean;      // 輸入文件是否就緒
  output_path?: string;      // 輸出文件路徑
  blocked_by?: string;       // 阻塞原因
}
```

### 4.2 API 介面

```
# Spec Gate 驗證
POST /api/sdd/spec-gate
Content-Type: application/json

{
  "spec_slug": "intake-module",
  // RV-021 解決：require_reviewed 僅對非實作類 alias 生效。
  // 實作類 alias（implement、add-feature、fix-bug）呼叫時強制視為 true。
  "require_reviewed": true
}

Response 200 (passed):
{
  "passed": true,
  "spec_path": "docs/specs/intake-module.md",
  "version": "v1.1",
  "checks": [
    { "name": "file_exists", "passed": true, "message": "OK" },
    { "name": "version_reviewed", "passed": true, "message": "v1.1 ≥ v1.1" },
    { "name": "required_sections", "passed": true, "message": "All 5 sections present" },
    { "name": "review_file_exists", "passed": true, "message": "review file found" },
    { "name": "open_issues", "passed": true, "message": "No open review issues" }
  ]
}

Response 200 (failed):
{
  "passed": false,
  "checks": [
    { "name": "review_file_exists", "passed": false, "message": "docs/specs/review/intake-module-review.md not found. Run /dispatch 'review-spec' first." }
  ]
}

# 查詢 SDD 流程整體狀態
GET /api/sdd/status

# RV-022 採納：current_phase 推導演算法見 § 4.4
Response 200:
{
  "phases": [SDDPhaseStatus],
  "current_phase": "1.2",
  "blocked_phases": ["1.3"],
  "completable_phases": ["1.2"]
}

# 取得規格文件列表
GET /api/sdd/specs
Query: ?status=reviewed

Response 200:
{
  "specs": [
    {
      "slug": "intake-module",
      "version": "v1.1",
      "sections_complete": true,
      "review_status": "all_resolved",
      "spec_gate_ready": true
    }
  ]
}

# 比對規格與實作（規格漂移偵測）
POST /api/sdd/drift-check
Content-Type: application/json

{
  "spec_slug": "intake-module",
  "impl_path": "src/modules/intake/"
}

Response 200:
{
  "drifts": [
    {
      "ac_id": "AC-05",
      "description": "AC-05 要求 400 回應，但實作回傳 422",
      "severity": "high"
    }
  ],
  "total_acs": 8,
  "passed": 7,
  "failed": 1,
  "analysis_method": "ai",       // 分析方式
  "coverage_note": "AI 分析不保證 100% 覆蓋，建議搭配人工審查"
}
```

### 4.3 元件設計

```
src/
├── modules/
│   └── sdd/
│       ├── index.ts              # 模組入口
│       ├── spec-gate.ts          # Spec Gate 驗證邏輯（含修正後的 review 文件檢查）
│       ├── spec-parser.ts        # 解析 Markdown 規格文件（支援阿拉伯數字與中文數字標題）
│       ├── review-parser.ts      # 解析 review 文件
│       ├── version-manager.ts    # 版本號管理與 changelog 生成（含 v2.0 IPC 確認）
│       ├── drift-checker.ts      # 規格與實作漂移偵測（AI 分析策略）
│       └── api.ts                # REST API 路由
docs/
├── intake/                       # Phase 1.1 輸出
│   └── <slug>.md
├── specs/                        # Phase 1.2、1.4 輸出
│   ├── <module>.md
│   └── review/                   # Phase 1.3 輸出
│       └── <module>-review.md
├── reviews/                      # Phase 3.1 程式碼審查輸出
├── qa/                           # Phase 3.2 QA 報告輸出
└── security/                     # Phase 3.4 安全審計輸出
```

### 4.4 Spec Gate 驗證邏輯

```typescript
// RV-021 解決：實作類 alias 強制使用 require_reviewed=true
const IMPL_ALIASES = ["implement", "add-feature", "fix-bug"];

async function runSpecGate(
  specSlug: string,
  requireReviewed: boolean,
  callerAlias?: string
): Promise<SpecGateResult> {
  const checks: SpecGateCheck[] = [];
  const specPath = `docs/specs/${specSlug}.md`;
  const reviewPath = `docs/specs/review/${specSlug}-review.md`;

  // 實作類 alias 強制 require_reviewed=true
  const effectiveRequireReviewed =
    callerAlias && IMPL_ALIASES.includes(callerAlias) ? true : requireReviewed;

  // Check 1: 文件存在
  const exists = await fileExists(specPath);
  checks.push({
    name: "file_exists",
    passed: exists,
    message: exists ? "OK" : `${specPath} not found`
  });

  if (!exists) return { passed: false, spec_path: specPath, version: "N/A", checks };

  // Check 2: 解析版本號
  const content = await readFile(specPath);
  const version = parseVersion(content);
  const versionOk = effectiveRequireReviewed ? compareVersion(version, "v1.1") >= 0 : true;
  checks.push({
    name: "version_reviewed",
    passed: versionOk,
    message: versionOk ? `${version} ≥ v1.1` : `${version} < v1.1. Run review-spec first.`
  });

  // Check 3: 必要章節存在
  const sections = parseRequiredSections(content);
  const sectionsOk = REQUIRED_SECTIONS.every(s => sections.includes(s));
  checks.push({
    name: "required_sections",
    passed: sectionsOk,
    message: sectionsOk ? "All 5 sections present" : `Missing: ${getMissing(sections)}`
  });

  // Check 4: RV-018 解決 — review 文件必須存在（require_reviewed=true 時）
  if (effectiveRequireReviewed) {
    const reviewExists = await fileExists(reviewPath);
    checks.push({
      name: "review_file_exists",
      passed: reviewExists,
      message: reviewExists
        ? "review file found"
        : `${reviewPath} not found. Run /dispatch 'review-spec' first.`
    });

    if (!reviewExists) {
      // review 文件不存在時直接失敗，不繼續執行 open_issues 檢查
      return { passed: false, spec_path: specPath, version, checks };
    }

    // Check 5: 無 OPEN 的 review 問題
    const openIssues = await getOpenIssues(reviewPath);
    const noOpenIssues = openIssues.length === 0;
    checks.push({
      name: "open_issues",
      passed: noOpenIssues,
      message: noOpenIssues
        ? "No open issues"
        : `${openIssues.length} open issues: ${openIssues.map(i => i.id).join(", ")}`
    });
  }

  const passed = checks.every(c => c.passed);
  return { passed, spec_path: specPath, version, checks };
}
```

**current_phase 推導演算法（RV-022 採納）：**

```typescript
// GET /api/sdd/status 使用此演算法推導 current_phase
function deriveCurrentPhase(phases: SDDPhaseStatus[]): string {
  // 規則：找出最後一個 status 為 "done" 的 Phase，其下一個 Phase 即為 current_phase
  // 若無任何 done Phase，current_phase 為 "1.1"
  // 若多個 Phase 為 in_progress，取序號最小者
  const PHASE_ORDER = ["1.1", "1.2", "1.3", "1.4", "2.1", "2.2", "2.3", "2.4", "2.5",
                       "3.1", "3.2", "4.1", "4.2", "5.x"];

  const inProgress = phases.filter(p => p.status === "in_progress");
  if (inProgress.length > 0) {
    return inProgress.sort((a, b) =>
      PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase)
    )[0].phase;
  }

  const donePhases = phases.filter(p => p.status === "done");
  if (donePhases.length === 0) return "1.1";

  const lastDone = donePhases.sort((a, b) =>
    PHASE_ORDER.indexOf(b.phase) - PHASE_ORDER.indexOf(a.phase)
  )[0];

  const nextIndex = PHASE_ORDER.indexOf(lastDone.phase) + 1;
  return nextIndex < PHASE_ORDER.length ? PHASE_ORDER[nextIndex] : lastDone.phase;
}
```

### 4.5 Drift Checker 實作規範

> **RV-019 解決**：完整定義 drift-check 的分析策略。

**分析方式：AI 分析（claude-sonnet-4-6）**

```typescript
// drift-checker.ts 的核心流程
async function runDriftCheck(specSlug: string, implPath: string): Promise<DriftResult[]> {
  // Step 1: 讀取規格文件，提取 AC 清單
  const specContent = await readFile(`docs/specs/${specSlug}.md`);
  const acList = parseAcceptanceCriteria(specContent);  // 解析 ## 5. 驗收標準 表格

  // Step 2: 掃描實作目錄，收集相關程式碼
  // 策略：掃描 implPath 下所有 .ts 文件，提取函數簽名與重要邏輯（非完整代碼）
  const implSummary = await summarizeImplementation(implPath);

  // Step 3: 呼叫 AI 分析 AC 與實作的對應關係
  const prompt = buildDriftCheckPrompt(acList, implSummary);
  const response = await callClaudeAPI(prompt);  // 回應為結構化 JSON

  // Step 4: 解析結果並回傳
  return parseDriftResult(response);
}
```

**Prompt 結構：**

```
System: 你是一位程式碼審查專家，負責驗證實作是否符合規格文件的驗收標準（AC）。
       對每條 AC，判斷實作是否滿足，並以 JSON 格式輸出結果。

User: 規格驗收標準：
{ac_list_json}

實作摘要：
{impl_summary}

請對每條 AC 輸出：{ "ac_id": "AC-01", "passed": true/false, "description": "說明" }
```

**已知限制（必須在 API 回應中說明）：**

- AI 分析不保證 100% 覆蓋，對複雜邏輯可能誤判
- 實作摘要僅包含部分代碼，完整性受限
- 建議搭配人工審查，不作為唯一驗收依據

---

## 5. 驗收標準（Acceptance Criteria）

| AC-ID | 條件 | 測試方式 |
|-------|------|---------|
| AC-01 | 執行 `/dispatch "implement"` 時，若目標模組的規格文件不存在，任務立即停止並顯示 Spec Gate 失敗訊息 | 刪除 spec 文件後觸發 implement |
| AC-02 | 規格文件版本為 `v1.0` 時，Spec Gate 失敗，提示需先執行 review-spec + update-spec | 使用 v1.0 文件觸發 implement |
| AC-03 | 規格文件缺少任意必要章節（目標/範圍、使用者故事、功能規格、技術規格、驗收標準），Spec Gate 失敗並列出缺失章節 | 移除章節後執行 spec-gate |
| AC-04 | `docs/specs/review/<module>-review.md` 不存在時，Spec Gate 失敗，提示需先執行 review-spec | 刪除 review 文件後執行 implement 觸發 spec-gate |
| AC-05 | `docs/specs/review/<module>-review.md` 含有 OPEN 問題時，Spec Gate 失敗並列出所有 OPEN 問題 ID | 手動設置 OPEN 問題後執行 spec-gate |
| AC-06 | `update-spec` 完成後，規格文件版本號自動遞增（`v1.0` → `v1.1`），並在文件末尾加入 changelog | 版本號與 changelog 解析確認 |
| AC-07 | review 文件中所有問題都標記為 RESOLVED 後，Spec Gate 中的 open_issues 檢查通過 | 手動將所有問題設為 RESOLVED 後執行 spec-gate |
| AC-08 | `GET /api/sdd/status` 正確反映所有 Phase 的狀態（not_started / in_progress / done / blocked） | API 回應結構與實際文件狀態一致 |
| AC-09 | drift-check API 能識別實作不符合 AC 的情況，並輸出具體不符合的 AC-ID 與說明；回應包含 `analysis_method` 與 `coverage_note` | 故意讓實作違反 AC-05，確認 drift-check 偵測到 |
| AC-10 | 整個 Phase 1 完成後（1.1→1.2→1.3→1.4），所有規格文件版本 ≥ v1.1，所有 review 問題 RESOLVED，Spec Gate 通過 | 端對端整合測試 |
| AC-11 | `write-spec` 生成的規格文件必須包含所有 5 個必要章節，缺一不可 | 解析輸出文件的 Markdown 標題 |
| AC-12 | 呼叫 Spec Gate 時傳入 `require_reviewed: false` 但 alias 為實作類（implement/add-feature/fix-bug），系統強制以 `true` 執行並記錄警告 | API 測試：傳入 false，確認 review 相關 check 仍執行 |

---

## Changelog

### v1.1 — 2026-03-22
- 解決 RV-018（阻擋）：修正 § 4.4 Spec Gate 實作—require_reviewed=true 時 review 文件不存在直接失敗，不跳過；並將 check 名稱從 `open_issues` 拆分為 `review_file_exists` + `open_issues` 兩個獨立 check
- 解決 RV-019（阻擋）：在 § 4.5 定義 drift-checker 實作機制（AI 分析策略、Prompt 結構、輸入格式、已知限制）
- 解決 RV-020（警告）：在 § 3.6 釐清「review-spec 文件生成」（無需確認）與「審查結果確認」（需人工）的邊界
- 解決 RV-021（警告）：在 § 3.2 與 § 4.4 限制 require_reviewed=false 僅對非實作類 alias 生效；實作類 alias 強制 require_reviewed=true；API 加入 AC-12
- 解決 RV-024（跨模組警告）：在 § 3.3 定義 spec-parser.ts 支援的兩種標題格式（阿拉伯數字與中文數字）
- 採納 RV-022（建議）：在 § 4.4 定義 current_phase 推導演算法
- 採納 RV-023（建議）：在 § 3.4 定義 v2.0 大版本升級的 IPC 確認流程
- [待議] RV-026：MVP 主列表（M1–MN）不屬於工作流規格範疇，將由 ROADMAP.md 統一維護；本文件僅引用 MVP 編號，不重複定義清單

### v1.0 — 2026-03-22
- 初始版本，由 write-spec 任務生成

---

*此規格文件由 dispatch worker（write-spec 任務）自動生成。如有修訂請更新版本號並加入 changelog。*
