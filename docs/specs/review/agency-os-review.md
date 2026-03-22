# Agency OS 規格審查報告

> **審查版本**：v1.0（三份規格文件）
> **審查日期**：2026-03-22
> **審查者**：dispatch worker / claude-sonnet-4-6（review-spec 任務）
> **審查對象**：intake-module.md、dispatch-module.md、sdd-workflow.md

---

## 問題清單

| RV-ID | 規格文件 | 章節 | 嚴重度 | 問題類型 | 問題描述 | 狀態 |
|-------|---------|------|-------|---------|---------|------|
| RV-001 | intake-module | 3.1 / 3.2 | **阻擋** | 模糊 | CLI 觸發格式與必填欄位衝突 | RESOLVED（v1.1）|
| RV-002 | intake-module | 3.5 | **阻擋** | 遺漏 | Slug 未定義非 ASCII 字元處理 | RESOLVED（v1.1）|
| RV-003 | intake-module | 3.4 / 4.1 | 警告 | 矛盾 | 輸出文件第五章節無對應資料結構 | RESOLVED（v1.1）|
| RV-004 | intake-module | 5 AC-06 | 警告 | 不可測試 | AC-06 使用「或」導致行為未明確 | RESOLVED（v1.1）|
| RV-005 | intake-module | 4.4 | 警告 | 遺漏 | Prompt 未含 budget 欄位且無 AI 失敗重試定義 | RESOLVED（v1.1）|
| RV-006 | intake-module | 4.1 | 建議 | 遺漏 | FeatureItem.phase 無允許值集合 | RESOLVED（v1.1）|
| RV-007 | intake-module | 4.1 | 建議 | 遺漏 | NextAction.dispatch_alias 未定義驗證規則 | RESOLVED（v1.1）|
| RV-008 | intake-module | 4.1 | 建議 | 模糊 | IntakeOutput.version 與 SDD 版本控制關係未說明 | RESOLVED（v1.1）|
| RV-009 | dispatch-module | 3.1 / 3.6 | **阻擋** | 遺漏 | 任務 slug 生成規則未定義 | RESOLVED（v1.1）|
| RV-010 | dispatch-module | 3.4 / 4.4 | **阻擋** | 技術可行性 | Claude Code 環境下 10 秒輪詢機制不可行 | RESOLVED（v1.1）|
| RV-011 | dispatch-module | 3.5 | 警告 | 遺漏 | 狀態機缺少 TIMED_OUT 後轉移與 PENDING→FAILED 路徑 | RESOLVED（v1.1）|
| RV-012 | dispatch-module | 4.4 | 警告 | 技術可行性 | Windows 環境 fs.rename() 原子性未說明 | RESOLVED（v1.1）|
| RV-013 | dispatch-module | 3.6 | 警告 | 遺漏 | Plan 模板格式及與 context 整合方式未定義 | RESOLVED（v1.1）|
| RV-014 | dispatch-module | 4.2 / 5 AC-10 | 警告 | 矛盾 | API 回應範例缺少 failed 統計，與 AC-10 不符 | RESOLVED（v1.1）|
| RV-015 | dispatch-module | 5 AC-11 | 警告 | 不可測試 | AC-11 為流程約束非技術強制，無法寫出明確 pass/fail 測試 | RESOLVED（v1.1）|
| RV-016 | dispatch-module | 4.2 | 建議 | 遺漏 | DELETE API 未定義對 done/failed 任務的行為 | RESOLVED（v1.1）|
| RV-017 | dispatch-module | 3.4 | 建議 | 遺漏 | IPC 輪詢未定義如何確認 .answer 文件已完整寫入 | RESOLVED（v1.1）|
| RV-018 | sdd-workflow | 3.2 / 4.4 | **阻擋** | 矛盾 | Spec Gate 文字條件與程式碼實作不一致（review 文件存在性） | OPEN |
| RV-019 | sdd-workflow | 4.2 | **阻擋** | 模糊 | drift-check 實作機制完全未定義 | OPEN |
| RV-020 | sdd-workflow | 3.6 | 警告 | 矛盾 | review-spec 同時出現於人工介入點與非介入點清單 | OPEN |
| RV-021 | sdd-workflow | 3.2 / 4.2 | 警告 | 模糊 | require_reviewed 參數允許繞過 Spec Gate 版本要求 | OPEN |
| RV-022 | sdd-workflow | 4.2 | 建議 | 模糊 | GET /api/sdd/status 的 current_phase 判斷邏輯未定義 | OPEN |
| RV-023 | sdd-workflow | 3.4 | 建議 | 遺漏 | v2.0 大版本升級的人工確認機制未定義 | OPEN |
| RV-024 | 跨模組 | 全域 | 警告 | 整合衝突 | Spec Gate 章節掃描規則與各模組規格標題格式不一致 | OPEN |
| RV-025 | 跨模組 | 全域 | 警告 | 整合遺漏 | intake→write-spec 跨任務交接格式未定義（機器可讀性） | OPEN |
| RV-026 | 跨模組 | 全域 | 建議 | 遺漏 | MVP 編號（M1, M4, M5）無主列表可交叉驗證 | OPEN |

---

## 詳細問題說明

---

### RV-001 [阻擋] — intake-module § 3.1 / 3.2
**CLI 觸發格式與必填欄位衝突**

`3.1` 觸發方式定義：
```
/dispatch "intake: [需求描述]"
```
但 `3.2` 輸入欄位將 `project_name` 標為必填（is: 是）。
CLI 指令格式中沒有傳遞 `project_name` 的方式。
實作者無法判斷：是由 AI 從描述中自動提取 `project_name`？還是需要另一種語法？

**建議修正**：明確定義兩種觸發路徑的欄位傳遞方式，例如：
```
/dispatch "intake: project=[名稱] desc=[描述]"
```
或說明 `project_name` 由 AI 自動從描述中提取，並定義提取失敗的 fallback 行為。

---

### RV-002 [阻擋] — intake-module § 3.5
**Slug 生成規則未定義非 ASCII 字元處理**

規則僅說明「移除特殊字元，空格替換為 `-`」，範例為英文（`"My Project"` → `my-project`）。
本專案為中文場景，若 `project_name` 為「電商平台」，生成結果未定義。
可能結果：空字串、原樣保留、拼音轉換、哈希值——四種結果行為完全不同。

**建議修正**：
- 明確說明非 ASCII 字元的處理策略（建議：移除非 ASCII，若結果為空則使用 UUID 後綴）
- 加入 Slug 碰撞處理（例如 `my-project-2`）

---

### RV-003 [警告] — intake-module § 3.4 / 4.1
**輸出文件第五章節（功能模組複雜度表）無對應資料結構**

`3.4` 輸出文件結構第五章節為「功能模組複雜度表」，但 `IntakeOutput` 型別定義中無此欄位。`FeatureItem` 雖含 `complexity` 欄位，但沒有獨立的複雜度表型別。
實作者無法確定此章節的資料來源與格式。

**建議修正**：在 `IntakeOutput` 中加入 `complexity_table` 欄位，或明確說明此章節由 `mvp_features` + `nice_to_have_features` 的 `complexity` 欄位彙整而來。

---

### RV-004 [警告] — intake-module § 5 AC-06
**AC-06 使用「或」導致行為未明確，無法測試**

> AC-06：相同 `project_name` 重複提交時，舊文件被覆蓋（**或**加版本號），不產生重複檔案

「被覆蓋」與「加版本號」是兩種完全不同的行為，無法同時測試 pass/fail。

**建議修正**：選定一種行為並明確說明。建議：預設覆蓋，提供 `--version` 旗標可選擇版本化。

---

### RV-005 [警告] — intake-module § 4.4
**Prompt 未含 budget 欄位，且未定義 AI 解析失敗的重試機制**

`4.4` Prompt 範本的 User 部分未包含 `budget` 欄位，但 `3.2` 將其定義為選填輸入。
此外，`4.4` 說明「回應格式：結構化 JSON」，但未定義：
- JSON 格式不合規時的處理（重試次數？fallback 結構？）
- AC-08 要求「AI 解析失敗時不寫入空白文件」，但 4.4 未提供重試邏輯

**建議修正**：在 Prompt 範本中加入 `budget` 欄位；定義最多 N 次重試機制及最終失敗的回退行為。

---

### RV-006 [建議] — intake-module § 4.1
**FeatureItem.phase 為 string 無允許值集合**

```typescript
phase: string;  // 對應開發 Phase
```
允許任意字串，實作者無法判斷合法值（"Phase 1"？"1.1"？"M1"？）。

**建議修正**：改為 union type 或 enum，例如 `"1.1" | "1.2" | "2.1" | ...`

---

### RV-007 [建議] — intake-module § 4.1
**NextAction.dispatch_alias 未定義驗證規則**

```typescript
dispatch_alias: string;
```
未說明此值是否必須對應 dispatch-module 的 alias 清單。若 AI 生成了無效 alias（如 `"deploy-aws"`），downstream 任務會失敗。

**建議修正**：引用 dispatch-module alias 清單，並在 intake 輸出驗證時做 alias 合法性檢查。

---

### RV-008 [建議] — intake-module § 4.1
**IntakeOutput.version 與 SDD 規格版本控制的關係不明**

`IntakeOutput.version` 固定為 `"v1.0"`，但 sdd-workflow.md 有獨立的規格版本控制系統（v1.0 → v1.1）。
這是同一套版本系統，還是不同系統？不明確會造成後續整合混淆。

**建議修正**：說明 `IntakeOutput.version` 代表 intake 文件本身的版本（非 SDD 規格版本），或移除此欄位改用檔案系統時間戳記。

---

### RV-009 [阻擋] — dispatch-module § 3.1 / 3.6
**任務 slug 生成規則未定義**

Alias 表顯示 `/dispatch "write-spec: agency-os"` → slug `write-spec-agency-os`，推斷為 `{alias}-{context-kebab}`，但：
- context 含空格時如何處理？（`/dispatch "intake: 電商平台 React"` → ???）
- 同一 alias 重複執行時 slug 衝突如何解決？（第二次執行 `write-spec-agency-os` 時覆蓋或另建？）
- context 為空時（`/dispatch "review-spec"`）slug 僅為 `review-spec`？

**建議修正**：正式定義 slug 生成演算法，包含特殊字元處理、中文處理、衝突解決（timestamp suffix？）。

---

### RV-010 [阻擋] — dispatch-module § 3.4 / 4.4
**Claude Code 環境下 10 秒輪詢機制技術上不可行**

`4.4` 的 `waitForAnswer()` 使用 `sleep(10_000)` 在迴圈中輪詢，但：
- Claude Code 中的 agent 無法在工具呼叫之間真正 sleep
- 這個「worker」是指 Claude agent 本身還是獨立程序？若是 Claude agent，輪詢機制需透過不同方式實現（如 Cron 工具）
- AC-05 要求「用戶寫入 001.answer 後，Worker 在下次輪詢（≤10 秒）讀取」——在目前 claude 環境中此保證無法成立

**建議修正**：明確說明 worker 的執行環境（獨立 Node.js 進程？Claude agent？），並依此調整輪詢實作方式。若為 Claude agent，改為事件驅動（用戶回答後由主 agent 主動喚起 worker）。

---

### RV-011 [警告] — dispatch-module § 3.5
**狀態機缺少 TIMED_OUT 後的轉移路徑及 PENDING→FAILED**

```
TIMED_OUT → ???  （是否可重啟？如何重啟？）
PENDING → FAILED  （若 worker 啟動失敗？）
```
缺乏定義會導致實作者任意決定行為，造成測試盲點。

**建議修正**：補充 TIMED_OUT 後可重啟的流程（如 `/dispatch restart {task_id}`），以及 PENDING → FAILED 的觸發條件。

---

### RV-012 [警告] — dispatch-module § 4.4
**Windows 環境下 fs.rename() 原子性未說明**

本專案運行於 Windows（CLAUDE.md 明確標示）。Node.js 的 `fs.rename()` 在 Windows 上：
- 同磁碟區：通常原子（依賴 NTFS 行為，非 POSIX 保證）
- 跨磁碟區：非原子，改為 copy+delete

若 `.dispatch/` 目錄與 temp 目錄不在同一磁碟區，原子寫入失效。

**建議修正**：補充說明 temp 文件必須與目標文件在同一目錄（`${ipcDir}/.tmp_...`，規格中已如此，但需明確標注這是 Windows 相容性必要條件）。

---

### RV-013 [警告] — dispatch-module § 3.6
**Plan 模板格式及與 dispatch context 整合方式未定義**

Alias 表引用 `.dispatch/templates/intake-plan.md` 等模板，但：
- 模板的佔位符格式未定義（Handlebars？EJS？純文字？）
- `4.3` 元件設計說「Handlebars 格式」但正文未一致說明
- context 字串（alias 後的補充說明）如何注入模板未定義

**建議修正**：在 `4.3` 或獨立章節中定義模板引擎及佔位符規範，並至少提供一個完整模板範例。

---

### RV-014 [警告] — dispatch-module § 4.2 / 5 AC-10
**GET /api/dispatch/tasks API 回應與 AC-10 不符**

AC-10：
> 回傳所有任務，含狀態統計（**running / done / failed** 數量）

但 `4.2` API 回應範例：
```json
{ "tasks": [...], "total": 5, "running": 2, "done": 3 }
```
缺少 `failed`、`timed_out`、`waiting_input` 統計。

**建議修正**：統一 API 回應結構，包含所有 `TaskStatus` 的計數。

---

### RV-015 [警告] — dispatch-module § 5 AC-11
**AC-11 為流程約束，無法寫出明確 pass/fail 測試**

> AC-11：plan.md 中的 [x] → [ ] 不可由外部直接回滾（write 操作只能由 task-runner 進行）

無技術強制機制（檔案系統權限、程序間鎖等），無法自動化測試。

**建議修正**：要麼提供技術強制機制（如 file lock 或 ACL），要麼將此條改為文件規範（非 AC），並移出驗收標準表。

---

### RV-016 [建議] — dispatch-module § 4.2
**DELETE API 對已完成任務的行為未定義**

若任務狀態已為 `done` 或 `failed` 時呼叫 `DELETE /api/dispatch/tasks/:task_id`：
- 是否允許？回傳什麼？
- `context_saved: true/false` 對已完成任務意義為何？

**建議修正**：補充 DELETE 的前置條件與各狀態下的回應行為。

---

### RV-017 [建議] — dispatch-module § 3.4
**IPC 輪詢未定義 .answer 文件的完整性確認**

worker 輪詢 `fileExists(answerPath)` 後立即讀取。若用戶正在寫入（大段文字），worker 可能讀到部分內容。

**建議修正**：定義 answer 文件的寫入協議，例如：用戶寫入後需原子性 rename（同 question 機制），或 worker 需讀取後確認非空才繼續。

---

### RV-018 [阻擋] — sdd-workflow § 3.2 / 4.4
**Spec Gate 文字條件與程式碼實作不一致**

`3.2` 驗證條件第 3 點：
> 對應的 `docs/specs/review/<target-module>-review.md` **存在**

但 `4.4` 實作：
```typescript
if (await fileExists(reviewPath)) {
  // 僅在存在時才執行 open_issues 檢查
  // 若不存在，直接跳過
}
```
若 review 文件不存在，`4.4` 不會失敗，但 `3.2` 說應失敗。矛盾。

**建議修正**：統一行為——若 `require_reviewed: true`，review 文件不存在應導致 Gate 失敗，需在 `4.4` 中加入對應 check。

---

### RV-019 [阻擋] — sdd-workflow § 4.2
**drift-check 的實作機制完全未定義**

```
POST /api/sdd/drift-check
```
說明「識別實作不符合 AC 的情況」，但完全未說明：
- 如何比對規格 AC 文字與實際程式碼行為？
- 是使用 AI 分析？靜態分析？執行測試？
- `drift-checker.ts` 元件的輸入格式為何？

這是整個 SDD 模組最複雜的元件，卻是規格文件中說明最少的部分。

**建議修正**：在 `4.3` 或獨立章節定義 drift-check 的分析策略（建議：AI 分析 AC 敘述 + grep 實作，輸出結構化報告），並說明已知限制（無法保證 100% 覆蓋）。

---

### RV-020 [警告] — sdd-workflow § 3.6
**review-spec 同時出現於人工介入點與非介入點清單，互相矛盾**

`3.6` 人工介入點表格：
> 規格審查 1.3 — 確認所有問題都是真實問題（非誤報）

同節非介入點清單：
> write-spec、**review-spec**、update-spec 的文件生成（無需確認）

同一 Phase 1.3 的 review-spec 既需要人工確認，又列為無需確認，語義衝突。

**建議修正**：釐清「review-spec 執行」（AI 自動）與「review 結果確認」（人工）的邊界。建議：review-spec 生成屬自動；人工介入點為「確認審查結果是否完整」，並重新措辭。

---

### RV-021 [警告] — sdd-workflow § 3.2 / 4.2
**require_reviewed 參數允許繞過 Spec Gate 版本要求**

`4.2` API 接受 `require_reviewed: false`，此時跳過版本 ≥ v1.1 檢查。但 `3.2` 功能規格明確要求 `implement` 必須通過完整 Spec Gate。
若 dispatch-module 在呼叫時傳 `false`，整個 Spec Gate 機制失效。

**建議修正**：限制 `require_reviewed: false` 僅允許特定 alias（如 `review-spec` 本身），或移除此參數，改為 Spec Gate 內部依 alias 類型決定嚴格度。

---

### RV-022 [建議] — sdd-workflow § 4.2
**GET /api/sdd/status 的 current_phase 判斷邏輯未定義**

API 回傳 `current_phase: "1.2"` 和 `blocked_phases`，但判斷邏輯不明：
- 根據哪些文件是否存在來決定？
- 若同時有多個 Phase in_progress，current_phase 如何選取？

**建議修正**：在 `4.4` 或補充章節說明 Phase 狀態推導演算法（例如：最後一個 output 存在的 Phase + 1 = current）。

---

### RV-023 [建議] — sdd-workflow § 3.4
**v2.0 大版本升級的人工確認機制未定義**

> v2.0：重大架構變更，需人工確認，大版本 +1

但確認方式未定義：
- 透過 IPC 問答？
- 需要特定 git commit 訊息？
- 需要某個 approve 文件？

**建議修正**：定義 v2.0 升級的觸發條件與確認流程，建議與 IPC 機制整合（dispatch worker 提問，用戶回答 yes 後才執行版本升級）。

---

### RV-024 [警告] — 跨模組整合
**Spec Gate 章節掃描規則與各模組規格標題格式不一致**

`sdd-workflow § 3.3` 要求掃描章節 1–5，使用英文格式：
```markdown
## 1. 目標與範圍
## 2. 使用者故事
...
```

但 `intake-module § 3.4` 的輸出文件使用中文數字：
```markdown
## 一、專案背景摘要
## 二、MVP 功能清單
...
```

spec-parser.ts 需要同時處理兩種格式，但規格中未說明。

**建議修正**：統一所有規格文件的章節標題格式，或在 spec-parser.ts 中明確定義支援的標題模式清單。

---

### RV-025 [警告] — 跨模組整合
**intake → write-spec 跨任務交接格式未定義（機器可讀性）**

`sdd-workflow § 3.1` 說明 Phase 1.2 的輸入為 `docs/intake/<slug>.md`，由 write-spec worker 讀取。
但 intake 模組輸出為人類可讀 Markdown，write-spec worker 需解析哪些欄位、如何提取，完全未定義。
若 write-spec worker 無法穩定解析 intake 輸出，整個 Phase 1→2 流程中斷。

**建議修正**：
1. 定義 write-spec 讀取 intake 文件時使用的解析協議（如：讀取整份 Markdown 作為 AI prompt 上下文，或提取特定章節）
2. 或在 intake-module 輸出中加入 machine-readable sidebar（如 YAML frontmatter 含結構化欄位）

---

### RV-026 [建議] — 跨模組整合
**MVP 編號（M1, M4, M5）無主列表可交叉驗證**

- `intake-module`：對應 MVP M1（Phase 1.1–1.2）、M4（Phase 2.2）
- `dispatch-module`：對應 MVP M5（Phase 2.3）
- `sdd-workflow`：對應 Phase 1–5 全流程

M1~M5 的完整列表、每個 MVP 的定義、Phase 對應關係均無主文件記錄。

**建議修正**：在 `docs/specs/` 或 `ROADMAP.md` 中加入 MVP 主列表，明確定義 M1–MN 的名稱、描述、對應 Phase。

---

## Phase 5.2 規格迭代更新（2026-03-22）

以下問題由 QA 審查與程式碼審查（Phase 3）發現，非原始 review-spec 輸出，於 Phase 5.2 規格迭代中解決：

| 問題編號 | 規格文件 | 嚴重度 | 問題描述 | 狀態 |
|---------|---------|-------|---------|------|
| 警告-02 | intake-module | 中 | `version` 欄位永遠硬寫 "v1.0"，不支援遞增 | RESOLVED（v1.2）— §3.4 補充 SDD 設計說明：首次生成固定 v1.0，後續由 update-spec + version-manager 負責遞增 |
| 警告-03 | intake-module | 中 | intake 模型規格衝突（§4.4 sonnet vs dispatch alias 表 opus） | RESOLVED（v1.2）— §4.4 統一改為 claude-opus-4-6 |
| 警告-04 | dispatch-module | 中 | GET /tasks/:id 有副作用（timed_out 狀態更新） | RESOLVED（v1.2）— §4.2 補充讀取語義說明，明確被動偵測設計；建議短期替代端點 POST /tasks/:id/check |
| 警告-05 | dispatch-module | 中 | `askAndPause` 未儲存 context 即拋出例外 | RESOLVED（v1.2）— §4.4 補充前置條件：writeQuestion 與 saveContext 必須各自成功後才可拋出 WaitingForInputError |
| QA-F4 | intake-module | 中 | `mvp_features` 無最少 1 項驗證（已實作但 AC 未記錄） | RESOLVED（v1.2）— 新增 AC-10 |
| QA-F5 | intake-module | 中 | `risks` 無最少 1 項驗證（已實作但 AC 未記錄） | RESOLVED（v1.2）— 新增 AC-11 |
| SEC-002 | dispatch-module | 高 | 所有 API 端點缺少身份驗證 | RESOLVED（v1.2）— 新增 §4.6 安全規格：X-API-Key Header 驗證、AGENCY_API_KEY 環境變數、401/503 回應規格 |
| SEC-004 | dispatch-module | 中 | 缺少速率限制（DoS 風險） | RESOLVED（v1.2）— 新增 §4.7 速率限制規格：max 60 req/min per IP，sliding window，429 + Retry-After |

---

## 整體評估

三份規格文件結構清晰、格式統一，顯示有良好的規格撰寫基礎。主要問題集中在以下三個層面：

### 1. 執行環境假設（最高風險）
`dispatch-module` 的 IPC 輪詢機制（RV-010）和 `sdd-workflow` 的 drift-check（RV-019）兩個 [阻擋] 問題，根本原因是規格假設了一個「可 sleep / 可長時間 polling 的 worker 進程」，與 Claude Code agent 的實際執行模型不符。建議在進入 Phase 2 實作前，先確認 worker 的執行模型，並視情況重新設計 IPC 機制。

### 2. 跨模組整合（中等風險）
intake → write-spec 的資料交接（RV-025）和 Spec Gate 的章節格式標準化（RV-024）是兩個會在實際整合時造成問題的缺口，建議在 update-spec 階段一併補充。

### 3. 驗收標準可測試性（低風險但需處理）
AC-06、AC-11 等問題屬於「寫得出來但測不到」的 AC，建議在 update-spec 時修正措辭或轉為文件規範，確保每條 AC 都能對應一個明確的 pass/fail 測試案例。

---

*此審查報告由 dispatch worker（review-spec 任務）自動生成於 2026-03-22。解決問題後請執行 `/dispatch "update-spec"` 並將已解決問題標記為 RESOLVED。*
