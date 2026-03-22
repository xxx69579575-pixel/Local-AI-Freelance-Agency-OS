# Phase 5.2 — 規格迭代修訂完成摘要

> **完成日期**：2026-03-22
> **任務**：修訂 intake-module.md 和 dispatch-module.md（v1.1 → v1.2），解決 code review 和 QA 發現的規格缺口

---

## 修訂成果

### intake-module.md（v1.1 → v1.2）

| 問題 | 修訂內容 | 位置 |
|------|---------|------|
| 警告-03（模型衝突） | §4.4 模型從 `claude-sonnet-4-6` 改為 `claude-opus-4-6`，與 dispatch alias 表（intake → opus）保持一致 | §4.4 |
| 警告-02（version 硬寫） | §3.4 補充設計說明：parser 首次生成固定輸出 `"v1.0"`，後續版本遞增由 `update-spec` + `version-manager.ts` 負責，此為 SDD 模組職責分離設計 | §3.4 |
| QA-F4（mvp_features 驗證） | 新增 AC-10：`mvp_features` 陣列最少 1 個 FeatureItem，空陣列觸發重試 | §5 AC-10 |
| QA-F5（risks 驗證） | 新增 AC-11：`risks` 陣列最少 1 個 RiskItem，空陣列觸發重試 | §5 AC-11 |

**AC 數量**：9（v1.1）→ 11（v1.2）

---

### dispatch-module.md（v1.1 → v1.2）

| 問題 | 修訂內容 | 位置 |
|------|---------|------|
| 警告-04（GET 副作用） | §4.2 補充「讀取語義」說明：GET 端點為純讀取，timed_out 偵測為被動偵測，正式狀態更新應由 PATCH 或 task-runner 負責；提供 POST /tasks/:id/check 替代方案 | §4.2 |
| 警告-05（askAndPause 前置條件） | §4.4 補充前置條件：`writeQuestion()` 和 `saveContext()` 各自成功後才可拋出 `WaitingForInputError`；任一失敗應傳播原始錯誤（FAILED 狀態），確保 context 持久化的原子性 | §4.4 |
| SEC-002（無身份驗證） | 新增 §4.6：X-API-Key Header 驗證規格，AGENCY_API_KEY 環境變數，401（無效金鑰）/ 503（未設定）回應，fail-secure 原則 | §4.6（新增）|
| SEC-004（速率限制） | 新增 §4.7：max 60 req/min per IP，sliding window 演算法，429 + Retry-After 回應，Serverless 環境限制說明 | §4.7（新增）|

**新增章節**：§4.6（安全規格 SEC-002）、§4.7（速率限制規格 SEC-004）

---

### docs/specs/review/agency-os-review.md

- **RV-001 ~ RV-017**：全部標記為 `RESOLVED（v1.1）`（原本全為 OPEN）
- **Phase 5.2 新增問題表格**：記錄警告-02/03/04/05、QA-F4/F5、SEC-002/004，均標記為 `RESOLVED（v1.2）`

---

## 規格版本狀態

| 文件 | 原版本 | 新版本 | 狀態 |
|------|-------|-------|------|
| intake-module.md | v1.1 | v1.2 | ✅ 已更新 |
| dispatch-module.md | v1.1 | v1.2 | ✅ 已更新 |
| agency-os-review.md | — | — | ✅ RV 狀態已更新 |

---

## 未解決問題（超出本任務範圍）

以下問題在本次規格迭代中**刻意不修訂**，留待後續 Sprint 處理：

| 問題 | 原因 |
|------|------|
| 嚴重-01（YAML 注入） | 程式碼 bug，屬於實作修復範疇（Phase 5.3 重構） |
| SEC-001（Context7 金鑰） | 環境設定問題，非規格缺口 |
| QA-F1（sdd-workflow 未實作） | 獨立 Sprint 實作範疇 |
| QA-F2（context.md 未寫入） | 程式碼 bug，屬於實作修復範疇 |
| QA-F3（project_name 三段式） | 程式碼 bug，屬於實作修復範疇 |
| RV-018 ~ RV-026（sdd-workflow） | 等待 sdd-module 實作後再修訂 |

---

*此摘要由 dispatch worker（phase-5-2-spec-update 任務）自動生成於 2026-03-22。*
