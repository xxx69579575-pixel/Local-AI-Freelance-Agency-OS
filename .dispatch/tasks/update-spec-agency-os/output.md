# Phase 1.4 update-spec — 完成摘要

**完成時間**：2026-03-22
**任務**：根據審查報告（docs/specs/review/agency-os-review.md）修訂三份規格文件

---

## 修訂結果

所有三份規格文件已升版至 **v1.1**，頂部加入版本號與 changelog 標頭。

### 阻擋問題（6/6 已解決）

| RV-ID | 規格 | 解決方式 |
|-------|------|---------|
| RV-001 | intake-module | 定義 CLI 觸發時 project_name 的三段式提取流程（AI → IPC → 時間戳 fallback） |
| RV-002 | intake-module | 定義非 ASCII slug 處理：移除非 ASCII + UUID fallback + 碰撞遞增 |
| RV-009 | dispatch-module | 在 § 3.1.1 正式定義 slug 生成演算法（alias + context-kebab，中文移除，碰撞加時間戳）|
| RV-010 | dispatch-module | 明確 worker 為 Claude agent；以事件驅動式 IPC（askAndPause + checkPendingAnswer）取代 sleep-polling |
| RV-018 | sdd-workflow | 修正 Spec Gate § 4.4：require_reviewed=true 時 review 文件不存在直接失敗（原代碼跳過）|
| RV-019 | sdd-workflow | 在 § 4.5 定義 drift-checker：AI 分析策略 + Prompt 結構 + 輸入格式 + 已知限制 |

### 警告問題（12/12 已解決）

| RV-ID | 規格 | 解決方式 |
|-------|------|---------|
| RV-003 | intake-module | 補充複雜度表來源：由 mvp_features + nice_to_have_features 的 complexity 欄位動態彙整 |
| RV-004 | intake-module | AC-06 明確為「直接覆蓋」，移除歧義的「或加版本號」 |
| RV-005 | intake-module | Prompt 加入 budget；定義最多 3 次嘗試（2 次重試）的失敗處理機制 |
| RV-011 | dispatch-module | 狀態機補充 TIMED_OUT→PENDING（restart）與 PENDING→FAILED 觸發條件 |
| RV-012 | dispatch-module | § 4.4 說明 temp 文件必須同目錄（Windows NTFS 原子性必要條件）|
| RV-013 | dispatch-module | 定義 Handlebars 模板格式、可用變數清單，提供完整 intake-plan.md 範例 |
| RV-014 | dispatch-module | GET /api/dispatch/tasks 回應補齊所有狀態計數（failed/timed_out/waiting_input/pending）|
| RV-015 | dispatch-module | AC-11 改為文件規範約束，移出 AC 表格 |
| RV-020 | sdd-workflow | 釐清 review-spec 邊界：執行為非介入點，審查結果確認為介入點 |
| RV-021 | sdd-workflow | 限制 require_reviewed=false 僅用於非實作類 alias；實作類強制 true；新增 AC-12 |
| RV-024 | sdd-workflow（跨模組）| spec-parser.ts 支援阿拉伯數字與中文數字兩種標題格式 |
| RV-025 | sdd-workflow（跨模組）| intake 輸出加入 YAML frontmatter；定義 write-spec 讀取協議（優先 frontmatter，次選整份 Markdown）|

### 建議問題（8 項）

| RV-ID | 規格 | 處置 |
|-------|------|------|
| RV-006 | intake-module | 採納：FeatureItem.phase 改為 union type |
| RV-007 | intake-module | 採納：NextAction.dispatch_alias 加入合法性驗證說明 |
| RV-008 | intake-module | 採納：澄清 IntakeOutput.version 為 intake 文件版本 |
| RV-016 | dispatch-module | 採納：DELETE API 各狀態行為定義（running/pending/done/failed/timed_out）|
| RV-017 | dispatch-module | 採納：.answer 文件完整性確認（原子寫入 + 非空確認）|
| RV-022 | sdd-workflow | 採納：定義 current_phase 推導演算法 |
| RV-023 | sdd-workflow | 採納：定義 v2.0 大版本升級的 IPC 確認流程 |
| RV-026 | 跨模組 | **待議**：MVP 主列表不在規格文件範疇，由 ROADMAP.md 統一維護 |

---

## 修訂文件清單

| 文件 | 原版本 | 新版本 |
|------|-------|-------|
| `docs/specs/intake-module.md` | v1.0 | v1.1 |
| `docs/specs/dispatch-module.md` | v1.0 | v1.1 |
| `docs/specs/sdd-workflow.md` | v1.0 | v1.1 |

---

## 下一步

所有阻擋問題已解決，Spec Gate 條件已滿足。可執行：

```
/dispatch "implement: docs/specs/intake-module.md"
```

建議先由人工確認三份修訂後的規格，特別是：
- dispatch-module § 3.4（事件驅動式 IPC 機制）是否符合實際開發需求
- sdd-workflow § 4.5（drift-checker AI 分析策略）的已知限制是否可接受
