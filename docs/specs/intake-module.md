<!-- 版本：v1.1 | 更新日期：2026-03-22 -->
<!-- Changelog：
- 解決審查問題 RV-001、RV-002（阻擋）：定義 CLI 觸發時 project_name 自動提取邏輯與 fallback；定義非 ASCII slug 處理策略與碰撞解決
- 解決審查問題 RV-003、RV-004、RV-005（警告）：補充複雜度表資料來源；明確 AC-06 為覆蓋行為；Prompt 加入 budget；定義重試機制
- 採納建議 RV-006：FeatureItem.phase 改為 union type
- 採納建議 RV-007：NextAction.dispatch_alias 加入驗證說明
- 採納建議 RV-008：澄清 IntakeOutput.version 為 intake 文件版本
- 連帶解決 RV-025（跨模組警告）：輸出文件加入 YAML frontmatter，定義 write-spec 讀取協議
-->

# 客戶需求訪談模組規格文件 — intake-module

> **文件版本**：v1.1
> **建立日期**：2026-03-22
> **更新日期**：2026-03-22
> **方法論**：SDD（Spec-Driven Development）
> **對應 MVP**：M1（Phase 1.1–1.2）、M4（Phase 2.2）

---

## 1. 目標與範圍（Goals & Scope）

### 1.1 目標

提供一個結構化的客戶需求收集流程，讓 freelancer（或 AI agent）能在最短時間內將模糊的客戶描述轉化為可操作的結構化需求文件，輸出至 `docs/intake/`，作為後續 SDD 規格撰寫的輸入。

### 1.2 範圍（In Scope）

- 以互動式問答或靜態表單收集客戶需求
- 輸出結構化 intake 文件（含背景摘要、MVP 清單、技術風險）
- 支援以 `/dispatch "intake: [描述]"` 指令觸發
- 輸出文件格式：Markdown（含 YAML frontmatter），存放於 `docs/intake/<slug>.md`

### 1.3 範圍外（Out of Scope）

- 自動寄送 email 或與客戶直接通訊
- CRM 整合
- 多輪對話記憶（超出單次 dispatch 任務範圍）

---

## 2. 使用者故事（User Stories）

| ID | 角色 | 故事 | 驗收條件摘要 |
|----|------|------|-------------|
| US-01 | Freelancer | 我想輸入客戶需求描述，獲得結構化的需求摘要，這樣我不需要手動整理 | intake 文件含背景、MVP 清單、風險 |
| US-02 | Freelancer | 我想讓 AI agent 自動判斷需求優先順序，這樣我能聚焦在 MVP | 輸出包含 P0/P1/P2 優先級分類 |
| US-03 | Freelancer | 我想快速識別技術風險，這樣部署時不會措手不及 | 輸出風險清單含嚴重度與緩解策略 |
| US-04 | AI Agent | 我需要讀取 intake 文件作為 write-spec 任務的輸入 | 文件含 YAML frontmatter，格式一致且機器可讀 |

---

## 3. 功能規格（Functional Spec）

### 3.1 觸發方式

**方式一：CLI 指令（project_name 由 AI 自動提取）**

```
/dispatch "intake: [需求描述或原始需求文件內容]"
```

> **RV-001 解決**：CLI 觸發時，`project_name` 欄位由 AI 自動從描述中提取最像專案名稱的名詞（取前 50 個字元中辨識度最高者）。若 AI 無法提取，執行 fallback 流程：
> 1. 嘗試從描述前 50 字元識別專案名稱
> 2. 若仍不明確，透過 IPC 問答機制向用戶詢問「請提供專案名稱」
> 3. 若 IPC 逾時（3 分鐘無回應），使用時間戳 fallback：`project-YYYYMMDD-HHmm`

**方式二：CLI 指令（明確傳遞 project_name）**

```
/dispatch "intake: project=[專案名稱] desc=[需求描述]"
```

> `project=` 與 `desc=` 為固定前綴關鍵字。當需求描述中含有明確專案名稱時，建議使用此格式以避免 AI 提取不準確。

**方式三：Web API（Phase 2.2）**

於 intake form UI 頁面填寫並提交（所有欄位明確傳遞，無需 AI 提取）。

### 3.2 輸入（Input）

| 欄位 | 類型 | 必填 | 來源 | 說明 |
|------|------|------|------|------|
| `project_name` | string | 是（自動提取或用戶提供） | CLI：AI 提取或 IPC；Web：用戶填寫 | 專案名稱（用於 slug 生成） |
| `description` | string | 是 | CLI / Web | 客戶需求自由文字描述（可長文） |
| `deadline` | string | 否 | CLI / Web | 預期交付日期（ISO 8601 格式） |
| `budget` | string | 否 | CLI / Web | 預算範圍（可為文字描述） |
| `tech_constraints` | string[] | 否 | CLI / Web | 技術限制（如「必須用 React」） |

### 3.3 處理流程

```
輸入需求描述
    ↓
提取 project_name（AI 自動提取 → IPC 詢問 → 時間戳 fallback）
    ↓
AI 解析：識別核心功能、隱含需求、技術限制
    ↓
生成背景摘要（一段話）
    ↓
分類功能為 MVP / Nice-to-Have
    ↓
識別技術風險（嚴重度：高/中/低）
    ↓
建議實作優先順序
    ↓
驗證 AI 回應 JSON 格式（最多重試 2 次，共 3 次嘗試）
    ↓
生成 YAML frontmatter + Markdown 輸出
    ↓
寫入 docs/intake/<slug>.md
```

### 3.4 輸出文件結構

輸出文件必須包含 YAML frontmatter 及以下所有章節：

```markdown
---
project_name: "my-project"
version: "v1.0"
created_at: "2026-03-22T10:00:00+08:00"
intake_slug: "my-project"
---

# [project_name] — 客戶需求訪談分析報告

## 一、專案背景摘要
## 二、MVP 功能清單（必要）
## 三、Nice-to-Have 功能清單（可選）
## 四、技術風險清單
## 五、功能模組複雜度表
## 六、建議實作優先順序
## 七、下一步行動
```

> **RV-003 解決**：第五章節「功能模組複雜度表」無獨立資料結構，其資料來源為 `IntakeOutput.mvp_features` 與 `nice_to_have_features` 中所有 `FeatureItem` 的 `complexity` 欄位彙整。由 `template.ts` 動態生成，格式為：
>
> | 功能 ID | 功能名稱 | 優先級 | 複雜度 |
> |---------|---------|-------|-------|
> | M1 | ... | MVP | high |

> **RV-025 解決（跨模組）**：`write-spec` worker 讀取 intake 文件時，優先解析 YAML frontmatter 中的結構化欄位（`project_name`、`intake_slug`、`version`）；需要完整上下文時，將整份 Markdown（含 frontmatter）作為 AI prompt 的輸入，無需自行解析 Markdown 章節。

### 3.5 Slug 生成規則

> **RV-002 解決**：完整定義 slug 生成策略，包含非 ASCII 字元處理與碰撞解決。

生成步驟（依序執行）：

1. 將 `project_name` 全部轉為小寫
2. 移除所有非 ASCII 字元（包含中文、日文、特殊符號）
3. 將空格與連字號以外的特殊字元替換為 `-`
4. 壓縮連續 `-`，前後 trim
5. **若結果為空字串**（如 `project_name` 全為中文）：使用 UUID v4 的前 8 碼作為 slug，格式：`proj-{8碼UUID}`（例：`proj-a1b2c3d4`）
6. **碰撞處理**：若 `docs/intake/<slug>.md` 已存在，在 slug 末尾附加遞增數字（`my-project-2`、`my-project-3`，依此類推）

**範例：**

| 輸入 | 輸出 |
|------|------|
| `"My Project"` | `my-project` |
| `"電商平台"` | `proj-a1b2c3d4`（UUID fallback） |
| `"React App 2.0"` | `react-app-20` |
| `"My Project"`（碰撞）| `my-project-2` |

輸出路徑：`docs/intake/<slug>.md`

---

## 4. 技術規格（Technical Spec）

### 4.1 資料結構

```typescript
// IntakeInput — 訪談輸入
interface IntakeInput {
  project_name: string;         // 必填（CLI 可由 AI 自動提取）
  description: string;          // 必填，自由文字
  deadline?: string;            // ISO 8601 日期字串
  budget?: string;              // 文字描述
  tech_constraints?: string[];  // 技術限制列表
}

// RiskItem — 技術風險項目
interface RiskItem {
  id: string;           // "R1", "R2", ...
  description: string;  // 風險描述
  severity: "high" | "medium" | "low";
  mitigation: string;   // 緩解策略
}

// FeatureItem — 功能項目
interface FeatureItem {
  id: string;           // "M1", "M2", ... 或 "N1", "N2", ...
  name: string;         // 功能名稱
  description: string;  // 功能說明
  priority: "MVP" | "nice-to-have";
  // RV-006 解決：對應 ROADMAP 定義的開發階段；"5.x" 涵蓋所有 Phase 5 子階段
  phase: "1.1" | "1.2" | "1.3" | "1.4" | "2.1" | "2.2" | "2.3" | "2.4" | "2.5" | "3.1" | "3.2" | "4.1" | "4.2" | "5.x";
  complexity: "high" | "medium" | "low";
}

// IntakeOutput — 訪談輸出文件
interface IntakeOutput {
  project_name: string;
  // RV-008 解決：此 version 代表本份 intake 文件的版本，獨立於 SDD 規格版本系統。
  // 首次生成固定為 "v1.0"；同一專案後續重新分析則遞增為 "v1.1" 等。
  version: string;
  created_at: string;       // ISO 8601
  background_summary: string;
  mvp_features: FeatureItem[];
  nice_to_have_features: FeatureItem[];
  risks: RiskItem[];
  implementation_order: string[];  // 功能 ID 排序
  next_actions: NextAction[];
}

// NextAction — 下一步行動
interface NextAction {
  priority: "P0" | "P1" | "P2" | "P3";
  task: string;
  // RV-007 解決：dispatch_alias 必須對應 dispatch-module alias 清單中的合法值。
  // 生成後由 alias-registry.ts 驗證；若 AI 生成無效 alias，替換為預設值 "write-spec"。
  dispatch_alias: string;
  model: "opus" | "sonnet" | "haiku";
}
```

### 4.2 API 介面

#### CLI 指令（透過 `/dispatch`）

```bash
# 觸發 intake 任務（project_name 由 AI 從描述自動提取）
/dispatch "intake: [需求描述]"

# 明確傳遞 project_name
/dispatch "intake: project=[名稱] desc=[需求描述]"

# 輸入長文需求（引用檔案）
/dispatch "intake: $(cat requirements.txt)"
```

#### Intake Form Web API（Phase 2.2 實作）

```
POST /api/intake
Content-Type: application/json

{
  "project_name": "string",
  "description": "string",
  "deadline": "2026-06-01",
  "budget": "50,000 TWD",
  "tech_constraints": ["React", "TypeScript"]
}

Response 200:
{
  "status": "success",
  "output_path": "docs/intake/my-project.md",
  "summary": { ...IntakeOutput }
}

Response 400:
{
  "status": "error",
  "message": "project_name and description are required"
}
```

### 4.3 元件設計

```
src/
├── modules/
│   └── intake/
│       ├── index.ts           # 模組入口
│       ├── parser.ts          # 需求文字解析（含 project_name 提取邏輯）
│       ├── classifier.ts      # MVP vs Nice-to-Have 分類
│       ├── risk-analyzer.ts   # 技術風險識別
│       ├── template.ts        # Markdown 輸出模板（含 YAML frontmatter 生成）
│       └── api.ts             # REST API 路由（Phase 2.2）
├── utils/
│   ├── slug.ts                # Slug 生成工具（含非 ASCII 處理、UUID fallback、碰撞解決）
│   └── file-writer.ts         # 文件寫入工具
└── types/
    └── intake.ts              # IntakeInput / IntakeOutput 型別定義
```

### 4.4 AI 處理邏輯

使用 Claude API（claude-sonnet-4-6）進行需求解析。Prompt 結構：

```
System: 你是一位資深 freelance 專案顧問，擅長分析客戶需求並輸出結構化文件。
       請根據需求描述，識別核心功能、技術風險，並輸出 JSON 格式的結構化摘要。
       輸出必須嚴格符合 IntakeOutput 型別的合法 JSON，不可包含任何額外說明文字或 markdown 代碼塊。

User: 以下是客戶需求描述：
{description}

技術限制：{tech_constraints}
截止日期：{deadline}
預算：{budget}
```

> **RV-005 解決**：Prompt 已加入 `budget` 欄位。

**AI 解析失敗處理（重試機制）：**

```
第 1 次呼叫 AI API
    ↓ 若 JSON 格式錯誤
第 2 次呼叫（在 prompt 末尾加入提示：「請確保只輸出合法 JSON，不含 markdown 代碼塊」）
    ↓ 若 JSON 格式仍錯誤
第 3 次呼叫（附上完整 IntakeOutput 範例 JSON，要求對照填寫）
    ↓ 若第 3 次仍失敗，或任何一次 API 逾時
輸出明確錯誤訊息（含失敗原因與嘗試次數）
不寫入任何文件
任務標記為 FAILED
```

---

## 5. 驗收標準（Acceptance Criteria）

| AC-ID | 條件 | 測試方式 |
|-------|------|---------|
| AC-01 | 輸入有效需求描述後，`docs/intake/<slug>.md` 檔案必須被創建 | 檔案系統確認 |
| AC-02 | 輸出文件必須包含 YAML frontmatter 及七個章節（背景摘要、MVP 清單、Nice-to-Have、風險清單、複雜度表、優先順序、下一步） | 解析 Markdown 標題與 frontmatter |
| AC-03 | MVP 功能清單至少包含 1 個項目，每個項目含 ID、名稱、說明、Phase | 結構驗證 |
| AC-04 | 風險清單至少包含 1 個項目，每個項目含嚴重度（高/中/低）與緩解策略 | 結構驗證 |
| AC-05 | 缺少 `project_name` 或 `description` 時，API 回傳 400 錯誤 | HTTP 回應碼確認 |
| AC-06 | 相同 `project_name` 重複提交時，**舊文件直接被覆蓋**，不產生重複檔案，不加版本號 | 檔案系統確認（僅存在一個同名文件） |
| AC-07 | `/dispatch "intake"` 觸發後，輸出文件的 YAML frontmatter 可被後續 `write-spec` 任務直接解析 | 整合測試 |
| AC-08 | AI 解析失敗時（API 逾時、格式錯誤），系統輸出明確錯誤訊息且不寫入空白文件；最多自動重試 2 次（共 3 次嘗試） | 錯誤注入測試 |
| AC-09 | CLI 觸發時若 `project_name` 無法從描述中提取，系統透過 IPC 詢問用戶；若 3 分鐘無回應，使用時間戳 fallback（`project-YYYYMMDD-HHmm`） | IPC 流程測試 |

---

## Changelog

### v1.1 — 2026-03-22
- 解決 RV-001（阻擋）：定義 CLI 觸發時 project_name 的三段式提取流程（AI 提取 → IPC → 時間戳 fallback）
- 解決 RV-002（阻擋）：定義非 ASCII 字元 slug 處理（移除 + UUID fallback）與碰撞解決機制
- 解決 RV-003（警告）：補充第五章節複雜度表的資料來源（由 mvp_features + nice_to_have_features 彙整，無獨立資料結構）
- 解決 RV-004（警告）：明確 AC-06 行為為「直接覆蓋舊文件」，移除歧義的「或加版本號」
- 解決 RV-005（警告）：Prompt 加入 budget 欄位；定義最多 3 次嘗試（2 次重試）的失敗處理機制
- 採納 RV-006（建議）：FeatureItem.phase 改為 union type
- 採納 RV-007（建議）：NextAction.dispatch_alias 加入合法性驗證說明（alias-registry.ts 驗證）
- 採納 RV-008（建議）：澄清 IntakeOutput.version 為 intake 文件版本，與 SDD 規格版本系統相互獨立
- 連帶解決 RV-025（跨模組警告）：輸出文件加入 YAML frontmatter；定義 write-spec 讀取協議（frontmatter 優先，必要時讀取整份 Markdown）

### v1.0 — 2026-03-22
- 初始版本，由 write-spec 任務生成

---

*此規格文件由 dispatch worker（write-spec 任務）自動生成。如有修訂請更新版本號並加入 changelog。*
