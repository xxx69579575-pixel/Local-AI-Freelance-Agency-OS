# 程式碼審查報告 — Phase 3.1

> **審查日期**：2026-03-22
> **審查者**：dispatch worker（code-review 任務）
> **審查範圍**：`src/modules/intake/`、`src/modules/dispatch/`、`src/utils/`、`src/types/`
> **對照規格**：`docs/specs/intake-module.md` (v1.1)、`docs/specs/dispatch-module.md` (v1.1)、`docs/specs/sdd-workflow.md` (v1.1)

---

## 統計摘要

| 級別 | 數量 |
|------|------|
| 🔴 嚴重 | 1 |
| 🟡 警告 | 7 |
| 🔵 建議 | 8 |
| **總計** | **16** |

---

## 🔴 嚴重問題（須立即修復，可能影響正確性或安全性）

---

### [嚴重-01] YAML frontmatter 注入：project_name 未做跳脫

- **檔案**：`src/modules/intake/template.ts:6`
- **問題描述**：
  `project_name` 欄位直接插入 YAML frontmatter 字串，未對雙引號進行跳脫。若 `project_name` 內含 `"` 字元（例如 `My "App"`），產生的 YAML 會格式錯誤，導致後續 `write-spec` worker 解析 frontmatter 失敗，且若 project_name 來自外部輸入，可破壞整個 frontmatter 結構。

  ```typescript
  // 當前：project_name: "My "App""  ← 非法 YAML
  `project_name: "${output.project_name}"`
  ```

- **修復建議**：
  在插入前對 `project_name`（及 `version`、`created_at`、`intake_slug`）做 YAML 字串跳脫，例如：
  ```typescript
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  `project_name: "${escape(output.project_name)}"`
  ```
  或改用 YAML 序列化函式庫（如 `js-yaml`）生成 frontmatter。

---

## 🟡 警告問題（影響正確性、規格符合度，或有潛在安全隱患）

---

### [警告-01] parser.ts 缺少 project_name IPC fallback 流程

- **檔案**：`src/modules/intake/parser.ts:58-94`
- **規格依據**：`intake-module.md § 3.1`、AC-09
- **問題描述**：
  規格定義 CLI 觸發時，`project_name` 須依序走三段提取流程：
  1. AI 自動從描述中提取
  2. 若 AI 無法提取，透過 IPC 詢問用戶「請提供專案名稱」
  3. 若 IPC 3 分鐘無回應，使用時間戳 fallback（`project-YYYYMMDD-HHmm`）

  目前 `analyseRequirements` 僅在 AI 回傳後取 `raw.project_name || input.project_name`，未實作 IPC 詢問或時間戳 fallback，AC-09 驗收標準無法通過。

- **修復建議**：
  在 `runIntake` 中加入 project_name 前置提取邏輯：若 `input.project_name` 為預設/空值，嘗試 AI 提取；失敗則透過 `askAndPause` IPC 詢問；IPC 逾時則生成 `project-YYYYMMDD-HHmm` fallback slug。

---

### [警告-02] version 永遠硬寫為 "v1.0"，不支援遞增

- **檔案**：`src/modules/intake/parser.ts:83`
- **規格依據**：`intake-module.md § 4.1`（RV-008 解決）
- **問題描述**：
  規格說明：「首次生成固定為 `v1.0`；同一專案後續重新分析則遞增為 `v1.1` 等。」
  目前 `output.version` 永遠為 `"v1.0"`，重新分析後仍覆蓋為 `v1.0`，無法追蹤文件版本歷史。

  ```typescript
  version: "v1.0",  // 永遠是 v1.0，未讀取現有文件的 version
  ```

- **修復建議**：
  在 `runIntake` 中，若目標路徑已存在文件，讀取其 frontmatter 的 `version`，解析後遞增小版本號（`v1.0` → `v1.1`）再寫入。

---

### [警告-03] 規格衝突：intake AI 模型定義不一致

- **檔案**：`src/modules/intake/parser.ts:70`（使用 `CONFIG.models.opus`）
- **規格依據**：`intake-module.md § 4.4` vs `dispatch-module.md § 3.6`
- **問題描述**：
  `intake-module.md § 4.4` 明確記載「使用 Claude API（`claude-sonnet-4-6`）進行需求解析」，但 `dispatch-module.md § 3.6` alias 表格中 `intake` 對應模型為 `opus`，`parser.ts` 也使用 `CONFIG.models.opus`（`claude-opus-4-6`）。兩份規格互相衝突，造成實作依據模糊。

- **修復建議**：
  由技術負責人裁決並統一兩份規格。若確定使用 opus（實作現狀），需更新 `intake-module.md § 4.4`；若改用 sonnet，需更新 `dispatch-module.md § 3.6` 及 `alias-registry.ts`。

---

### [警告-04] dispatch/api.ts GET 請求有副作用（非冪等）

- **檔案**：`src/modules/dispatch/api.ts:168-173`
- **規格依據**：HTTP 語意規範
- **問題描述**：
  `GET /api/dispatch/tasks/:task_id` 在讀取任務狀態時，若偵測到 pending_question 已逾時，會直接呼叫 `updateTaskStatus(taskId, "timed_out")`，修改持久化狀態。GET 請求應為冪等/無副作用，多次 GET 同一任務可能產生非預期的狀態轉移。

  ```typescript
  if (timedOut) {
    updateTaskStatus(taskId, "timed_out");  // GET 修改狀態：副作用
  }
  ```

- **修復建議**：
  將逾時偵測與狀態更新移至專用的 background checker 或在 POST/PATCH 端點觸發。GET 端點只需回傳目前狀態與 `is_timed_out: true` 標記供客戶端決策。

---

### [警告-05] ipc-manager.ts askAndPause 未儲存 context 即拋出例外

- **檔案**：`src/modules/ipc-manager.ts:13-18`（`askAndPause` 函式）
- **規格依據**：`dispatch-module.md § 3.4`、`§ 4.4`
- **問題描述**：
  規格明確定義流程為：「Worker 儲存當前執行上下文至 context.md → Worker 將 plan.md 對應項目標記為 [?]，停止執行」。`askAndPause` 目前只寫入 question 文件即拋出 `WaitingForInputError`，context 的儲存依賴外部呼叫者（`handleWaitingForInput`）。若呼叫者未正確傳入 context summary，context.md 將為空，Worker 重啟後無法恢復狀態。

- **修復建議**：
  `askAndPause` 應接受 `contextSummary` 參數並在拋出前寫入 `context.md`（規格 § 4.4 的 `saveContext(taskSlug)`），而非依賴外部呼叫者。

---

### [警告-06] dispatch/api.ts readBody 使用字串串接，非 Buffer 收集

- **檔案**：`src/modules/dispatch/api.ts:25-27`
- **問題描述**：
  ```typescript
  let data = "";
  req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
  ```
  `chunk.toString()` 預設使用 UTF-8，但在多位元組字元（如中文）跨 chunk 邊界切割時，`.toString()` 可能產生亂碼。`intake/api.ts` 使用正確的 `Buffer` 收集方式（`chunks.push(chunk)` + `Buffer.concat(chunks).toString()`）。

- **修復建議**：
  統一使用 `Buffer` 收集方式，與 `intake/api.ts` 的 `readBody` 實作一致。

---

### [警告-07] task-runner.ts taskStore 在 loadTasks 前可被存取

- **檔案**：`src/modules/dispatch/task-runner.ts:14`（`const taskStore = new Map()`）
- **問題描述**：
  `taskStore` 為模組層級 in-memory store，`loadTasks()` 必須在應用啟動時被呼叫以從 `tasks.json` 恢復任務。若呼叫者在 `loadTasks()` 完成前執行 `getTask()` 或 `listTasks()`，將得到空結果，且不會有任何錯誤提示，造成靜默資料遺失。

- **修復建議**：
  加入初始化守衛旗標（`let initialized = false`），在 `getTask`/`listTasks` 中若未初始化則拋出或記錄警告；或在模組匯出時自動觸發 `loadTasks()`。

---

## 🔵 建議（程式品質、可維護性、潛在邊緣情況）

---

### [建議-01] intake/api.ts 與 dispatch/api.ts 缺少請求 body 大小限制

- **檔案**：`src/modules/intake/api.ts:readBody`、`src/modules/dispatch/api.ts:readBody`
- **問題描述**：兩個 API 的 `readBody` 均無最大 body 大小限制，惡意或意外的超大請求將持續累積記憶體直到 OOM。
- **建議**：加入 body size 限制（如 1MB），超出時立即終止並回傳 `413 Payload Too Large`。

---

### [建議-02] dispatch/api.ts rawModel 型別斷言不正確

- **檔案**：`src/modules/dispatch/api.ts:134`
- **問題描述**：
  ```typescript
  (["opus", "sonnet", "haiku"] as const).includes(rawModel as "opus")
  ```
  將 `rawModel` 強制轉型為 `"opus"` 以通過 TypeScript 型別檢查，這是不精確的 workaround，未來維護者易誤解意圖。
- **建議**：使用 `(["opus", "sonnet", "haiku"] as string[]).includes(rawModel)` 或抽取為 type guard 函式。

---

### [建議-03] logger.ts LOG_LEVEL 環境變數缺少驗證

- **檔案**：`src/utils/logger.ts:10`
- **問題描述**：`currentLevel` 直接從環境變數讀取無驗證，若設為無效值（如 `LOG_LEVEL=VERBOSE`），`LEVELS[currentLevel]` 為 `undefined`，所有比較皆為 `NaN < number`（false），導致所有層級的日誌都被輸出。
- **建議**：加入有效值驗證，無效時 fallback 至 `"info"` 並輸出警告。

---

### [建議-04] file-writer.ts atomicWrite 失敗後未清理 temp 文件

- **檔案**：`src/utils/file-writer.ts:atomicWrite`
- **問題描述**：若 `fs.writeFile(tmpPath)` 成功但 `fs.rename(tmpPath, filePath)` 失敗，temp 文件（`.tmp_${Date.now()}_${base}`）將永久殘留在目錄中。
- **建議**：以 `try/finally` 或 `catch` 區塊在 rename 失敗後嘗試刪除 tmpPath。

---

### [建議-05] template-engine.ts 未防範 Handlebars 模板注入

- **檔案**：`src/modules/dispatch/template-engine.ts:renderTemplate`
- **問題描述**：`vars.context` 直接傳入 Handlebars 渲染，若用戶提供 `{{> somePartial}}` 或 `{{{rawOutput}}}` 等 Handlebars 語法作為 context，會觸發非預期的模板行為（雖然無已知 partial 定義，但仍屬潛在風險）。
- **建議**：在傳入 Handlebars 前，對 `vars.context` 等使用者輸入欄位做 Handlebars 跳脫（`Handlebars.escapeExpression`）或切換至純字串替換。

---

### [建議-06] ipc-manager.ts buildQuestionContent 未輸出 asked_at 欄位

- **檔案**：`src/modules/dispatch/ipc-manager.ts:buildQuestionContent`
- **問題描述**：`IPCMessage` 型別定義（`src/types/dispatch.ts`）包含 `asked_at` 欄位，但 `buildQuestionContent` 生成的問題文件未包含此欄位，導致 `IPCMessage` 型別的完整性無法從文件中恢復。
- **建議**：在問題文件中加入 `**提問時間**：{ISO 8601}` 欄位以符合型別定義。

---

### [建議-07] alias-registry.ts REGISTRY 與 DISPATCH_ALIASES 雙重維護，容易不同步

- **檔案**：`src/modules/dispatch/alias-registry.ts`、`src/config.ts`
- **問題描述**：alias 清單同時維護在 `config.ts` 的 `DISPATCH_ALIASES` 陣列與 `alias-registry.ts` 的 `REGISTRY` 物件中。新增 alias 時必須同步更新兩處，漏更新一處會導致靜默行為差異（`isValidAlias` 返回 false 但 REGISTRY 有值，或反之）。
- **建議**：以 `Object.keys(REGISTRY)` 動態生成 DISPATCH_ALIASES，消除重複定義。

---

### [建議-08] slug.ts resolveDispatchSlug 碰撞處理精度僅到分鐘

- **檔案**：`src/utils/slug.ts:resolveDispatchSlug`
- **問題描述**：碰撞時附加時間戳 `YYYYMMDDHHmm`（分鐘精度），在同一分鐘內建立兩個相同 alias+context 的任務仍會碰撞，與 `resolveIntakeSlug` 使用遞增整數的方式不同。
- **建議**：考慮附加秒數（`HHmmss`）或改用遞增整數後綴（與 intake slug 邏輯一致）。

---

## 規格符合度矩陣

| 規格 AC | 說明 | 符合狀態 |
|---------|------|---------|
| intake AC-01 | intake 文件被創建 | ✅ 符合 |
| intake AC-02 | 文件含 frontmatter + 七章節 | ✅ 符合 |
| intake AC-03 | MVP 清單至少 1 項 | ✅ 符合（由 AI 生成）|
| intake AC-04 | 風險清單至少 1 項 | ✅ 符合（由 AI 生成）|
| intake AC-05 | 缺少必填欄位回傳 400 | ✅ 符合 |
| intake AC-06 | 重複提交覆蓋舊文件 | ✅ 符合 |
| intake AC-07 | frontmatter 可被 write-spec 解析 | ⚠️ 部分（見 嚴重-01：YAML 注入風險）|
| intake AC-08 | 最多重試 3 次、不寫空白文件 | ✅ 符合 |
| intake AC-09 | IPC fallback 流程 | ❌ 未實作（見 警告-01）|
| dispatch AC-01 | 任務目錄與 plan.md 創建 | ✅ 符合 |
| dispatch AC-02 | 狀態 pending → running | ✅ 符合 |
| dispatch AC-03 | 完成後 output.md、狀態 done | ⚠️ 部分（output.md 無自動寫入邏輯）|
| dispatch AC-04 | IPC question 文件與 waiting_input | ✅ 符合 |
| dispatch AC-05 | Worker 讀取 answer 繼續執行 | ✅ 符合 |
| dispatch AC-06 | 逾時偵測 timed_out | ✅ 符合（但有副作用，見 警告-04）|
| dispatch AC-07 | answer 文件原子寫入且非空 | ✅ 符合 |
| dispatch AC-08 | 無效 alias 回傳 400 + 清單 | ✅ 符合 |
| dispatch AC-09 | 並行任務互不干擾 | ✅ 符合（各自獨立目錄）|
| dispatch AC-10 | GET tasks 含全狀態計數 | ✅ 符合 |

---

## 整體評估

程式碼整體品質**良好**，架構清晰，模組職責分明，TypeScript 型別覆蓋完整，防禦性編碼（null/undefined 處理）到位。

主要關注點：
1. **[嚴重-01] YAML 注入**需立即修復，影響 frontmatter 正確性與跨模組讀取。
2. **[警告-01] project_name IPC fallback** 是 AC-09 的驗收缺口，需在 Phase 3 測試前補齊。
3. **[警告-04] GET 副作用**應在 API 語意正確性重構中一併解決。
4. 其餘警告與建議可列入下一迭代的技術債清單。

---

*此報告由 dispatch worker（code-review 任務）自動生成，2026-03-22。*
