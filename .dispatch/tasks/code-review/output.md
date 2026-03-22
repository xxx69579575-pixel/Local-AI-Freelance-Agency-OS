# code-review 任務完成摘要

**完成時間**：2026-03-22
**報告路徑**：`docs/reviews/2026-03-22-code-review.md`

## 審查統計

| 級別 | 數量 |
|------|------|
| 🔴 嚴重 | 1 |
| 🟡 警告 | 7 |
| 🔵 建議 | 8 |
| **總計** | **16** |

## 關鍵發現

### 🔴 嚴重（須立即修復）
1. **[嚴重-01]** `template.ts:6` — YAML frontmatter 注入：`project_name` 未對雙引號跳脫，可能產生非法 YAML，破壞 write-spec 跨模組讀取流程。

### 🟡 警告（影響規格符合度或潛在安全隱患）
1. **[警告-01]** `parser.ts` — AC-09 缺口：CLI 觸發時 project_name IPC fallback 流程（詢問 + 時間戳 fallback）未實作。
2. **[警告-02]** `parser.ts:83` — `version` 永遠為 `"v1.0"`，重新分析後應遞增至 `v1.1`。
3. **[警告-03]** 跨規格衝突：`intake-module.md § 4.4` 說用 sonnet，`dispatch-module.md § 3.6` 說用 opus，實作用 opus；需統一規格。
4. **[警告-04]** `dispatch/api.ts:168-173` — GET 請求有副作用（timed_out 狀態轉移），違反 HTTP 冪等性。
5. **[警告-05]** `ipc-manager.ts:askAndPause` — 未在拋出前儲存 context，依賴呼叫者正確傳入 context summary。
6. **[警告-06]** `dispatch/api.ts:readBody` — 字串串接而非 Buffer 收集，多位元組字元跨 chunk 可能亂碼。
7. **[警告-07]** `task-runner.ts` — taskStore 可在 loadTasks() 完成前被存取，造成靜默空資料。

### 🔵 建議（技術債，可列入下一迭代）
- 兩個 API 無 body size 限制（DoS 風險）
- `rawModel as "opus"` TypeScript 型別斷言不精確
- `LOG_LEVEL` env 未驗證
- `atomicWrite` 失敗後未清理 temp 文件
- Handlebars 模板未防範 context 注入
- IPCMessage `asked_at` 欄位未輸出至問題文件
- DISPATCH_ALIASES 與 REGISTRY 雙重維護
- resolveDispatchSlug 碰撞精度僅分鐘

## 規格符合度評估

- **AC 通過率**：17/19（89.5%）
- **未通過**：intake AC-09（IPC fallback 未實作）
- **部分通過**：intake AC-07（YAML 注入風險）、dispatch AC-03（output.md 無自動寫入）

## 下一步建議

依優先度排序：
1. 修復 `template.ts` YAML 跳脫（嚴重-01）
2. 補實 `parser.ts` project_name IPC fallback（警告-01，AC-09）
3. 解決模型規格衝突並統一文件（警告-03）
4. 修復 GET 副作用（警告-04）
5. 其餘警告與建議列入技術債清單
