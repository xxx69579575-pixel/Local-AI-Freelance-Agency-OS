# review-spec-agency-os — 任務輸出摘要

**完成時間**：2026-03-22
**審查者**：claude-sonnet-4-6（dispatch worker）
**輸出文件**：`docs/specs/review/agency-os-review.md`

---

## 審查摘要

審查三份規格文件（intake-module、dispatch-module、sdd-workflow），共發現 **26 個問題**：

| 嚴重度 | 數量 | 說明 |
|-------|------|------|
| [阻擋] | 6 | 需解決才能進入 Phase 2 實作 |
| [警告] | 12 | 建議在 update-spec 時一併修正 |
| [建議] | 8 | 可選修正，有助於提升規格品質 |

## 阻擋問題摘要（需優先處理）

| RV-ID | 規格文件 | 核心問題 |
|-------|---------|---------|
| RV-001 | intake-module | CLI 觸發無法傳遞必填欄位 project_name |
| RV-002 | intake-module | Slug 未定義中文等非 ASCII 字元處理 |
| RV-009 | dispatch-module | 任務 slug 生成規則未定義（中文、重複衝突） |
| RV-010 | dispatch-module | Claude Code 環境下 10 秒輪詢機制不可行 |
| RV-018 | sdd-workflow | Spec Gate 文字條件與程式碼實作矛盾 |
| RV-019 | sdd-workflow | drift-check 實作機制完全未定義 |

## 下一步建議

執行 `/dispatch "update-spec: docs/specs/intake-module.md docs/specs/dispatch-module.md docs/specs/sdd-workflow.md"` 並以 `docs/specs/review/agency-os-review.md` 為修訂依據，優先解決 6 個 [阻擋] 問題後，所有規格版本升至 v1.1，可進入 Spec Gate 驗證。
