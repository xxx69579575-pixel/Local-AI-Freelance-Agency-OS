<!-- 版本：v1.2 | 更新日期：2026-03-22 -->
<!-- Changelog：
- 解決審查問題 RV-009（阻擋）：正式定義任務 slug 生成演算法（含特殊字元、中文、碰撞處理）
- 解決審查問題 RV-010（阻擋）：明確 worker 執行環境為 Claude agent；以事件驅動式 IPC 取代 sleep-polling
- 解決審查問題 RV-011、RV-012、RV-013、RV-014（警告）：補充狀態機轉移路徑；Windows 原子性說明；Plan 模板格式規範；GET API 補齊所有狀態統計
- 解決審查問題 RV-015（警告）：AC-11 改為文件規範約束，移出 AC 表格
- 採納建議 RV-016：補充 DELETE API 對 done/failed 任務的行為
- 採納建議 RV-017：定義 .answer 文件完整性確認協議
- v1.2：解決警告-04（GET /tasks/:id 讀取語義說明：timed_out 偵測為被動偵測，無寫入副作用）
- v1.2：解決警告-05（§3.4 askAndPause 前置條件：atomicWrite 必須成功後才拋出 WaitingForInputError）
- v1.2：新增 §4.6 安全規格 SEC-002（X-API-Key Header 驗證）
- v1.2：新增 §4.7 速率限制規格 SEC-004（max 60 req/min per IP）
-->

# 任務派遣與追蹤模組規格文件 — dispatch-module

> **文件版本**：v1.2
> **建立日期**：2026-03-22
> **更新日期**：2026-03-22
> **方法論**：SDD（Spec-Driven Development）
> **對應 MVP**：M5（Phase 2.3）

---

## 1. 目標與範圍（Goals & Scope）

### 1.1 目標

實作對應 `/dispatch` 工作流的任務派遣與追蹤模組，讓 freelancer 能夠：

1. 透過 alias 指令將複雜任務委派給指定 AI worker（sonnet / opus / haiku）
2. 追蹤任務狀態（待辦 / 進行中 / 完成 / 失敗）
3. 透過 IPC 機制（問答文件）與後台 worker 溝通
4. 查看任務輸出與歷史記錄

### 1.2 範圍（In Scope）

- `/dispatch` 指令解析與任務分發
- 任務計劃文件（`plan.md`）的 checklist 追蹤
- IPC 問答機制（`.question` / `.answer` / `.done` 文件流）
- 任務輸出文件（`output.md`）管理
- 任務狀態查詢 API
- 基本 Web 儀表板（任務清單 + 狀態）

### 1.3 範圍外（Out of Scope）

- 真正的多執行緒/多進程管理（在 Claude Code 環境內為單執行緒模擬）
- 任務間的依賴圖（DAG）排程
- 即時 WebSocket 推播（Phase 2.3 僅支援輪詢）
- 第三方任務管理工具整合（Jira、Linear 等）

---

## 2. 使用者故事（User Stories）

| ID | 角色 | 故事 | 驗收條件摘要 |
|----|------|------|-------------|
| US-01 | Freelancer | 我想用一行指令派遣 AI worker 執行任務，不需要手動設定 | `/dispatch "alias"` 成功建立並啟動任務 |
| US-02 | Freelancer | 我想查看所有進行中的任務及其狀態，這樣我知道哪些任務需要關注 | 儀表板顯示任務清單與即時狀態 |
| US-03 | Freelancer | 當 AI worker 需要我確認某事，我想收到通知並能回答，不會讓任務卡住 | IPC 問答機制正常運作 |
| US-04 | Freelancer | 我想查看已完成任務的輸出結果，以便進行下一步工作 | `output.md` 可讀取且格式正確 |
| US-05 | AI Worker | 我需要讀取 `plan.md` checklist，依序執行並更新狀態 | Checklist 格式一致，逐項更新 |
| US-06 | AI Worker | 當遇到無法自行解決的問題時，我需要提問並等待回答 | IPC 文件機制正常運作 |

---

## 3. 功能規格（Functional Spec）

### 3.1 Dispatch 指令格式

```bash
/dispatch "[alias]: [可選的補充說明或上下文]"

# 範例
/dispatch "intake: 客戶需要一個電商網站，React + Node.js，三個月交付"
/dispatch "write-spec: agency-os"
/dispatch "review-spec"
/dispatch "implement: docs/specs/intake-module.md"
```

### 3.1.1 任務 Slug 生成規則

> **RV-009 解決**：正式定義 slug 生成演算法。

格式：`{alias}-{context-kebab}`

生成步驟：

1. 取 alias（已為 kebab-case，直接使用）
2. 取 context 字串（alias 後的補充說明），執行 kebab 轉換：
   - 全部轉小寫
   - 移除所有非 ASCII 字元（含中文）
   - 空格與特殊字元替換為 `-`
   - 壓縮連續 `-`，前後 trim
3. 若 context-kebab 非空，組合為 `{alias}-{context-kebab}`
4. 若 context-kebab 為空（context 全為中文或 context 本身為空），slug 僅為 `{alias}`
5. **碰撞處理**：若 `.dispatch/tasks/<slug>/` 目錄已存在，附加時間戳後綴：`{slug}-{YYYYMMDDHHmm}`

**範例：**

| 指令 | Slug |
|------|------|
| `/dispatch "write-spec: agency-os"` | `write-spec-agency-os` |
| `/dispatch "intake: React 電商"` | `intake-react`（中文移除）|
| `/dispatch "intake: 電商平台"` | `intake`（context 全中文，fallback 為 alias）|
| `/dispatch "review-spec"` | `review-spec`（無 context）|
| `/dispatch "write-spec: agency-os"`（第二次）| `write-spec-agency-os-202603221015`（碰撞）|

### 3.2 任務目錄結構

每個 dispatch 任務在 `.dispatch/tasks/<task-slug>/` 下建立：

```
.dispatch/tasks/<task-slug>/
├── plan.md          # 任務計劃 checklist（worker 執行依據）
├── output.md        # 任務完成後的輸出摘要
├── context.md       # （選用）worker 暫停時保存的上下文
└── ipc/
    ├── .done            # 完成標記（worker 寫入）
    ├── 001.question     # 第一個問題（worker 提問）
    ├── 001.answer       # 第一個回答（用戶回答）
    ├── 001.done         # 問答完成標記
    ├── 002.question     # ...
    └── ...
```

### 3.3 plan.md Checklist 格式

Worker 依 checklist 由上到下執行，完成每項後更新狀態：

```markdown
# [任務名稱] — 計劃文件

- [ ] 步驟一描述
- [ ] 步驟二描述
- [x] 步驟三描述（已完成）<!-- note: 完成時間或備注 -->
- [?] 步驟四描述<!-- question: 需要確認 XXX -->
- [!] 步驟五描述<!-- error: 錯誤描述 -->
```

| 狀態標記 | 意義 |
|---------|------|
| `[ ]` | 待執行 |
| `[x]` | 已完成 |
| `[?]` | 等待用戶回答（worker 已暫停） |
| `[!]` | 發生不可解決的錯誤，已停止 |

### 3.4 IPC 問答流程

> **RV-010 解決**：Worker 執行環境為 **Claude Code agent**（非獨立 Node.js 進程）。
> Claude agent 無法在工具呼叫間真正 sleep，因此 IPC 機制採用**事件驅動式**設計，而非 sleep-polling 迴圈。

**事件驅動式 IPC 流程（Claude agent 環境）：**

```
Worker 需要提問
    ↓
原子寫入：先寫 ipc/.tmp_{NNN}.question，再 rename 至 ipc/{NNN}.question
    ↓
Worker 儲存當前執行上下文至 context.md
    ↓
Worker 將 plan.md 對應項目標記為 [?]，停止執行（任務狀態 → WAITING_INPUT）
    ↓
（用戶收到通知後）
    ↓
用戶原子寫入 answer：先寫 ipc/.tmp_{NNN}.answer，再 rename 至 ipc/{NNN}.answer
    ↓
主 agent 或用戶手動重新觸發 worker 繼續執行
    ↓
Worker 啟動時讀取 context.md → 確認 ipc/{NNN}.answer 存在且非空 → 繼續執行
    ↓
Worker 寫入 ipc/{NNN}.done → 繼續下一步驟
```

**3 分鐘逾時計算方式**：worker 寫入 question 時記錄 deadline 至 ipc/{NNN}.question 文件的 `等待截止` 欄位。用戶或監控程序在重新觸發 worker 前比較當前時間與 deadline；若已逾時，task_runner 將任務狀態轉為 TIMED_OUT。

問題文件格式：

```markdown
<!-- ipc/001.question -->
**問題**：[問題內容]
**背景**：[為何需要此資訊]
**選項**（可選）：
- A) 選項一
- B) 選項二
**等待截止**：2026-03-22T15:00:00+08:00
```

> **RV-017 採納**：answer 文件的完整性確認協議：
> - 用戶（或 API）寫入 answer 時，**必須使用原子寫入**（先寫至 `ipc/.tmp_{NNN}.answer`，再 rename 至 `ipc/{NNN}.answer`）
> - Worker 重啟後讀取 answer 前，確認檔案非空（`content.trim().length > 0`）；若為空則視為無效回答，仍保持 `[?]` 狀態

### 3.5 任務狀態機

```
PENDING → RUNNING → DONE
                  → WAITING_INPUT → RUNNING（用戶回答後重新觸發）
                                  → TIMED_OUT（deadline 過期時偵測）
           RUNNING → FAILED（不可解決的錯誤）

PENDING → FAILED（worker 啟動失敗：如 alias 不存在、模板文件缺失）
TIMED_OUT → PENDING（可重新啟動：透過 /dispatch restart {task_id}，重讀 context.md 繼續執行）
```

> **RV-011 解決**：
> - `TIMED_OUT → PENDING`：用戶執行 restart 後，worker 從 `context.md` 恢復上下文，重新進入執行循環
> - `PENDING → FAILED`：觸發條件包含：alias 不存在、對應模板文件缺失、plan.md 生成失敗

### 3.6 Alias 對應表（完整清單）

> **RV-013 解決**：Plan 模板使用 **Handlebars 格式**（`{{variable}}`），由 `template-engine.ts` 渲染。可用變數：`{{alias}}`、`{{context}}`、`{{model}}`、`{{slug}}`、`{{started_at}}`。模板範例見 § 4.3。

| Alias | 模型 | Plan 模板 | 輸出路徑 |
|-------|------|----------|---------|
| `intake` | opus | `.dispatch/templates/intake-plan.md` | `docs/intake/` |
| `write-spec` | opus | `.dispatch/templates/write-spec-plan.md` | `docs/specs/` |
| `review-spec` | sonnet | `.dispatch/templates/review-spec-plan.md` | `docs/specs/review/` |
| `update-spec` | sonnet | `.dispatch/templates/update-spec-plan.md` | `docs/specs/` |
| `implement` | sonnet | `.dispatch/templates/implement-plan.md` | `src/` |
| `add-feature` | sonnet | `.dispatch/templates/add-feature-plan.md` | `src/` |
| `fix-bug` | sonnet | `.dispatch/templates/fix-bug-plan.md` | `src/` |
| `write-tests` | sonnet | `.dispatch/templates/write-tests-plan.md` | `tests/` |
| `code-review` | opus | `.dispatch/templates/code-review-plan.md` | `docs/reviews/` |
| `qa-check` | sonnet | `.dispatch/templates/qa-check-plan.md` | `docs/qa/` |
| `security-audit` | opus | `.dispatch/templates/security-plan.md` | `docs/security/` |
| `deploy-vercel` | sonnet | `.dispatch/templates/deploy-vercel-plan.md` | — |
| `summarize` | sonnet | `.dispatch/templates/summarize-plan.md` | `docs/` |

---

## 4. 技術規格（Technical Spec）

### 4.1 資料結構

```typescript
// TaskStatus — 任務狀態
type TaskStatus = "pending" | "running" | "done" | "waiting_input" | "timed_out" | "failed";

// TaskRecord — 任務記錄
interface TaskRecord {
  id: string;               // UUID v4
  slug: string;             // kebab-case，用於目錄名稱
  alias: string;            // dispatch alias（如 "write-spec"）
  model: "opus" | "sonnet" | "haiku";
  status: TaskStatus;
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
  plan_path: string;        // 相對路徑，如 ".dispatch/tasks/write-spec-agency-os/plan.md"
  output_path?: string;     // 完成後的輸出文件路徑
  context?: string;         // 暫停時的上下文摘要
  error?: string;           // FAILED 狀態的錯誤描述
}

// IPCMessage — IPC 問答訊息
interface IPCMessage {
  sequence: number;         // 001, 002, ...
  question: string;         // 問題內容
  background: string;       // 背景說明
  options?: string[];       // 可選選項
  asked_at: string;         // ISO 8601
  deadline: string;         // ISO 8601，提問後 3 分鐘
  answer?: string;          // 用戶回答（讀取 .answer 後填入）
  answered_at?: string;     // ISO 8601
}

// ChecklistItem — plan.md 中的一個項目
interface ChecklistItem {
  index: number;
  status: "todo" | "done" | "question" | "error";
  description: string;
  note?: string;            // [x] 後的備注
}

// DispatchCommand — 解析後的 dispatch 指令
interface DispatchCommand {
  alias: string;
  context: string;          // alias 後的補充說明
  model: "opus" | "sonnet" | "haiku";  // 由 alias 決定
}
```

### 4.2 API 介面

#### 任務管理 REST API

```
# 建立並啟動任務
POST /api/dispatch
Content-Type: application/json

{
  "alias": "write-spec",
  "context": "agency-os",
  "model": "opus"  // 選填，預設由 alias 決定
}

Response 201:
{
  "task_id": "uuid-v4",
  "slug": "write-spec-agency-os",
  "status": "running",
  "plan_path": ".dispatch/tasks/write-spec-agency-os/plan.md"
}

# 查詢任務狀態（純讀取端點）
GET /api/dispatch/tasks/:task_id

# 警告-04 解決（讀取語義）：
# 此端點為純讀取（GET 語義），不應產生任何寫入副作用。
# timed_out 狀態偵測採用「被動偵測」設計：
#   - API handler 讀取任務記錄時，若 status 為 waiting_input 且
#     question 的 deadline 已過期，可在回應中附加 timed_out: true 旗標，
#     但不應在此端點更新 taskStore 的 status 欄位。
#   - timed_out 狀態的正式寫入應由 PATCH /api/dispatch/tasks/:task_id
#     端點（或 task-runner 的輪詢/重啟路徑）負責，以符合 HTTP 語義。
# 短期替代方案：若尚未實作 PATCH，可改用：
#   POST /api/dispatch/tasks/:task_id/check  →  檢查並更新 timed_out 狀態

Response 200:
{
  "task_id": "...",
  "slug": "write-spec-agency-os",
  "alias": "write-spec",
  "model": "opus",
  "status": "waiting_input",
  "created_at": "2026-03-22T10:00:00+08:00",
  "updated_at": "2026-03-22T10:05:00+08:00",
  "pending_question": {
    "sequence": 1,
    "question": "請確認輸出目錄...",
    "deadline": "2026-03-22T10:08:00+08:00"
  }
}

# 列出所有任務
GET /api/dispatch/tasks
Query: ?status=running&limit=20&offset=0

# RV-014 解決：回應包含所有 TaskStatus 的計數
Response 200:
{
  "tasks": [TaskRecord],
  "total": 8,
  "running": 2,
  "done": 3,
  "failed": 1,
  "timed_out": 1,
  "waiting_input": 1,
  "pending": 0
}

# 回答 IPC 問題
POST /api/dispatch/tasks/:task_id/answer
Content-Type: application/json

{
  "sequence": 1,
  "answer": "使用 docs/specs/ 目錄"
}

Response 200:
{
  "status": "ok",
  "task_status": "waiting_input"  // 仍為 waiting_input，直到 worker 被重新觸發
}

Response 400:
{
  "status": "error",
  "message": "answer cannot be empty"
}

# 停止任務
DELETE /api/dispatch/tasks/:task_id

# RV-016 採納：各狀態下的行為定義
# - running / waiting_input：停止任務，儲存 context.md，回傳 context_saved: true
# - pending：取消任務，不建立 context.md，回傳 context_saved: false
# - done / failed / timed_out：允許刪除（清除任務記錄），回傳 context_saved: false

Response 200:
{
  "status": "stopped",      // 或 "cancelled"（pending）、"deleted"（done/failed/timed_out）
  "context_saved": true     // 僅 running / waiting_input 為 true
}
```

### 4.3 元件設計

```
src/
├── modules/
│   └── dispatch/
│       ├── index.ts            # 模組入口，匯出公開 API
│       ├── command-parser.ts   # /dispatch 指令解析（含 slug 生成）
│       ├── task-runner.ts      # 任務建立、啟動、狀態管理
│       ├── plan-manager.ts     # plan.md 讀寫與 checklist 更新
│       ├── ipc-manager.ts      # IPC 問答文件管理（事件驅動式）
│       ├── alias-registry.ts   # Alias → model + template 對應
│       ├── template-engine.ts  # Handlebars 模板渲染
│       └── api.ts              # REST API 路由
├── templates/                  # plan.md 模板（Handlebars 格式）
│   ├── intake-plan.md
│   ├── write-spec-plan.md
│   └── ...
└── types/
    └── dispatch.ts             # 所有型別定義
```

**Plan 模板格式規範（RV-013 解決）：**

模板引擎：Handlebars（`{{variable}}` 語法）。可用變數：

| 變數 | 說明 |
|------|------|
| `{{alias}}` | dispatch alias 名稱 |
| `{{context}}` | alias 後的補充說明（可為空）|
| `{{model}}` | 使用的模型名稱 |
| `{{slug}}` | 任務 slug |
| `{{started_at}}` | 任務開始時間（ISO 8601） |

**完整模板範例**（`intake-plan.md`）：

```handlebars
# intake — 計劃文件

**Context**: {{context}}
**Model**: {{model}}
**Started**: {{started_at}}

- [ ] 解析輸入：提取 project_name（AI 自動提取，或透過 IPC 詢問）
- [ ] 呼叫 AI 分析需求，生成 IntakeOutput JSON（最多重試 2 次）
- [ ] 驗證 JSON 格式，確認所有必填欄位存在
- [ ] 生成 YAML frontmatter + Markdown 並寫入 docs/intake/{{slug}}.md
- [ ] 確認輸出文件可被 write-spec 讀取（frontmatter 解析測試）
- [ ] 寫入 output.md 摘要
```

### 4.4 IPC 實作規範

> **RV-010 解決**：以下實作對應 Claude agent 執行環境的事件驅動式設計。

```typescript
// 原子寫入問題文件（Windows 相容）
async function writeQuestion(taskSlug: string, seq: number, content: string): Promise<void> {
  const ipcDir = `.dispatch/tasks/${taskSlug}/ipc`;
  const seqStr = String(seq).padStart(3, "0");
  // RV-012 解決：temp 文件必須與目標文件在同一目錄（NTFS 同磁碟區原子性保證）
  const tempPath = `${ipcDir}/.tmp_${seqStr}.question`;
  const finalPath = `${ipcDir}/${seqStr}.question`;

  await fs.writeFile(tempPath, content, "utf-8");
  await fs.rename(tempPath, finalPath);  // Windows NTFS 同目錄 rename 具原子性
}

// 提問並停止（取代原 sleep-polling 的 waitForAnswer）
// 呼叫後 worker 應立即儲存 context 並結束執行
//
// 警告-05 解決（前置條件）：
// 1. writeQuestion() 必須成功完成（原子寫入完成且無 IO 錯誤），才可繼續後續步驟
// 2. saveContext() 必須成功完成（context.md 寫入確認），才可拋出 WaitingForInputError
// 若任一步驟失敗（拋出 Error），函式應向上傳播原始錯誤，不拋出 WaitingForInputError，
// 讓 task-runner 將任務狀態標記為 FAILED（而非 WAITING_INPUT），
// 確保問題文件存在且 context 已持久化後，worker 才正式進入等待狀態。
async function askAndPause(taskSlug: string, seq: number, content: string): Promise<never> {
  await writeQuestion(taskSlug, seq, content);  // 前置條件 1：原子寫入必須成功
  await saveContext(taskSlug);                   // 前置條件 2：context 持久化必須成功
  throw new WaitingForInputError(seq);           // task-runner 捕捉此 error，轉換狀態為 WAITING_INPUT
}

// Worker 重啟時：檢查是否有待處理的回答（非 sleep-polling，僅單次讀取）
async function checkPendingAnswer(taskSlug: string, seq: number): Promise<string | null> {
  const seqStr = String(seq).padStart(3, "0");
  const answerPath = `.dispatch/tasks/${taskSlug}/ipc/${seqStr}.answer`;

  if (!await fileExists(answerPath)) return null;

  const content = await fs.readFile(answerPath, "utf-8");
  // RV-017 採納：確認非空後才視為有效回答
  if (content.trim().length === 0) return null;

  // 寫入 .done 標記
  const donePath = `.dispatch/tasks/${taskSlug}/ipc/${seqStr}.done`;
  await fs.writeFile(donePath, new Date().toISOString(), "utf-8");

  return content.trim();
}
```

### 4.5 Plan Manager 實作規範

```typescript
// 讀取 plan.md 並解析 checklist
function parsePlan(content: string): ChecklistItem[]

// 更新特定項目的狀態
function updateItem(
  items: ChecklistItem[],
  index: number,
  status: ChecklistItem["status"],
  note?: string
): ChecklistItem[]

// 將 checklist 序列化回 Markdown
function serializePlan(title: string, items: ChecklistItem[]): string

// 完整更新流程（read → update → write）
async function markItemDone(planPath: string, index: number, note?: string): Promise<void>
async function markItemQuestion(planPath: string, index: number, question: string): Promise<void>
async function markItemError(planPath: string, index: number, error: string): Promise<void>
```

### 4.6 安全規格 — API 身份驗證（SEC-002）

> **SEC-002**：所有 `/api/dispatch/*` 及 `/api/intake` 端點必須驗證請求的身份，以防止未授權存取造成 Anthropic API 費用濫用或任務資料外洩。

**驗證機制：X-API-Key Header**

```
# 每個受保護端點的請求必須包含：
X-API-Key: <token>

# token 值從環境變數讀取：
AGENCY_API_KEY=<secret>
```

**實作規範：**

```typescript
// 中介層（middleware）：在所有 /api/* 路由前執行
function requireApiKey(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const expectedKey = process.env.AGENCY_API_KEY;

  // 若環境變數未設定，拒絕所有請求（fail-secure 原則）
  if (!expectedKey) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", message: "API key not configured" }));
    return;
  }

  const providedKey = req.headers["x-api-key"];
  if (!providedKey || providedKey !== expectedKey) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", message: "Unauthorized" }));
    return;
  }

  next();
}
```

**回應規格：**

| 情境 | HTTP 狀態碼 | 回應 body |
|------|------------|----------|
| 缺少 X-API-Key Header | 401 | `{"status":"error","message":"Unauthorized"}` |
| X-API-Key 值錯誤 | 401 | `{"status":"error","message":"Unauthorized"}` |
| AGENCY_API_KEY 環境變數未設定 | 503 | `{"status":"error","message":"API key not configured"}` |

**部署注意事項：**

- `AGENCY_API_KEY` 必須設定於 Vercel 環境變數（不可寫入程式碼或 `.env` 後提交至 git）
- 短期過渡期：若尚未設定 `AGENCY_API_KEY`，服務僅監聽 `127.0.0.1`（本機限制），拒絕外部連線
- 金鑰長度建議：最少 32 字元隨機字串（`openssl rand -hex 32`）

### 4.7 速率限制規格（SEC-004）

> **SEC-004**：為防止 DoS 攻擊與 Anthropic API 費用濫用，所有 `/api/*` 端點必須實作速率限制。

**速率限制規則：**

| 參數 | 值 |
|------|---|
| 限制單位 | per IP address |
| 最大請求數 | 60 req/min |
| 計算視窗 | Sliding window（滑動視窗，非固定視窗） |
| 超限回應碼 | 429 Too Many Requests |

**實作規範：**

```typescript
// 速率限制中介層（在 requireApiKey 之後執行）
interface RateLimitEntry {
  timestamps: number[];  // 最近 60 秒內的請求時間戳（ms）
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000;   // 60 秒
const MAX_REQUESTS = 60;        // 每視窗最大請求數

function rateLimit(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const ip = req.socket.remoteAddress ?? "unknown";
  const now = Date.now();

  let entry = rateLimitMap.get(ip) ?? { timestamps: [] };
  // 移除視窗外的舊時間戳
  entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    res.writeHead(429, {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSec)
    });
    res.end(JSON.stringify({
      status: "error",
      message: "Too many requests",
      retry_after_seconds: retryAfterSec
    }));
    return;
  }

  entry.timestamps.push(now);
  rateLimitMap.set(ip, entry);
  next();
}
```

**回應規格（超限時）：**

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 15

{
  "status": "error",
  "message": "Too many requests",
  "retry_after_seconds": 15
}
```

**注意事項：**

- `rateLimitMap` 儲存於記憶體，Serverless 環境（Vercel）中每個 function 實例各自計數，不跨實例共享
- 若需跨實例共享（高流量場景），應改用 Redis 或 Upstash 實作分散式速率限制（Phase 5.x 範疇）
- 定期清理 `rateLimitMap` 中無效條目（如：最後請求時間超過 5 分鐘的 IP）以防止記憶體洩漏

---

## 5. 驗收標準（Acceptance Criteria）

| AC-ID | 條件 | 測試方式 |
|-------|------|---------|
| AC-01 | `/dispatch "write-spec: agency-os"` 執行後，`.dispatch/tasks/write-spec-agency-os/` 目錄被建立，`plan.md` 存在 | 目錄/檔案存在確認 |
| AC-02 | 任務啟動後，狀態從 `pending` 轉為 `running` | API GET 狀態確認 |
| AC-03 | Worker 完成所有 checklist 項目後，`plan.md` 所有項目為 `[x]`，`output.md` 被寫入，狀態變為 `done` | 檔案內容 + API 狀態確認 |
| AC-04 | Worker 提問後，IPC 目錄出現 `001.question` 文件，任務狀態變為 `waiting_input`，`context.md` 被寫入 | 檔案存在 + API 狀態確認 |
| AC-05 | 用戶透過 API 寫入 `001.answer` 後，重新觸發 worker，worker 讀取 answer 並繼續執行，狀態回到 `running` | 端對端流程測試（無時序要求） |
| AC-06 | 提問後 deadline 過期，下次觸發時偵測到逾時，`plan.md` 對應項目標記為 `[?]`，任務狀態變為 `timed_out` | 計時測試（設置過去時間的 deadline）|
| AC-07 | `POST /api/dispatch/tasks/:id/answer` 成功後，對應的 `.answer` 文件被原子寫入 IPC 目錄且非空 | 檔案內容確認 |
| AC-08 | 不存在的 alias 被使用時，API 回傳 400 並列出有效 alias 清單 | HTTP 回應碼 + body 確認 |
| AC-09 | 同時有 2 個任務執行時，各自的 plan.md 和 ipc/ 目錄互不干擾 | 並行測試 |
| AC-10 | `GET /api/dispatch/tasks` 回傳所有任務，含全部狀態統計（running / done / failed / timed_out / waiting_input / pending） | API 回應結構驗證 |

> **RV-015 解決**：原 AC-11「plan.md 中的 [x] → [ ] 不可由外部直接回滾」已改為文件規範約束（無技術強制機制，無法自動化測試），移出 AC 表格。
>
> **文件規範約束**：`plan.md` 的 checklist 項目狀態只能由 `task-runner.ts` 透過 `plan-manager.ts` 修改。外部程序（如用戶直接編輯）不應回滾已完成項目。此約束依賴開發規範而非技術鎖定。

---

## Changelog

### v1.2 — 2026-03-22
- 解決警告-04（§4.2 GET /tasks/:id 讀取語義）：補充說明 timed_out 偵測為被動偵測（僅在回應附加旗標），正式狀態更新應由 PATCH 端點或 task-runner 重啟路徑負責，GET 端點不應有寫入副作用；提供 POST /tasks/:id/check 替代方案說明
- 解決警告-05（§4.4 askAndPause 前置條件）：補充說明 writeQuestion() 和 saveContext() 必須各自成功後才可拋出 WaitingForInputError；任一步驟失敗應向上傳播原始錯誤（FAILED 狀態），確保原子性
- 新增 §4.6 安全規格 SEC-002（X-API-Key Header 驗證）：定義 AGENCY_API_KEY 環境變數讀取、401/503 回應規格、fail-secure 原則與部署注意事項
- 新增 §4.7 速率限制規格 SEC-004（max 60 req/min per IP）：定義 sliding window 演算法、429 + Retry-After 回應規格、記憶體實作注意事項與 Serverless 限制說明

### v1.1 — 2026-03-22
- 解決 RV-009（阻擋）：在 § 3.1.1 正式定義 slug 生成演算法，包含 context-kebab 轉換、中文移除、alias-only fallback、碰撞時附加時間戳
- 解決 RV-010（阻擋）：明確 worker 執行環境為 Claude agent；以事件驅動式（askAndPause + checkPendingAnswer）取代 sleep-polling waitForAnswer；更新 § 3.4 流程圖與 § 4.4 實作
- 解決 RV-011（警告）：補充 TIMED_OUT→PENDING 重啟路徑及 PENDING→FAILED 觸發條件（§ 3.5）
- 解決 RV-012（警告）：在 § 4.4 補充說明 temp 文件必須與目標文件在同一目錄（Windows NTFS 原子性必要條件）
- 解決 RV-013（警告）：在 § 3.6 與 § 4.3 定義 Handlebars 模板格式、可用變數清單，並提供完整模板範例
- 解決 RV-014（警告）：GET /api/dispatch/tasks 回應補齊所有 TaskStatus 計數（§ 4.2）
- 解決 RV-015（警告）：AC-11 改為文件規範約束，移出 AC 表格（§ 5）
- 採納 RV-016（建議）：補充 DELETE API 對 running/pending/done/failed/timed_out 各狀態的行為定義（§ 4.2）
- 採納 RV-017（建議）：定義 answer 文件完整性確認協議（原子寫入 + 非空確認）（§ 3.4、§ 4.4）

### v1.0 — 2026-03-22
- 初始版本，由 write-spec 任務生成

---

*此規格文件由 dispatch worker（write-spec 任務）自動生成。如有修訂請更新版本號並加入 changelog。*
