# 客戶需求訪談分析報告 — Local AI Freelance Agency OS

> **文件版本**：v1.0
> **建立日期**：2026-03-22
> **方法論**：SDD（Spec-Driven Development / 規格驅動開發）
> **負責人**：Dispatch Worker（intake 任務）

---

## 一、專案背景摘要

**Local AI Freelance Agency OS** 是一套以 Claude Code 為核心驅動的 AI Freelance Agency 作業系統。

### 核心理念
- 讓 freelancer 透過 AI agent 自動化完成從「客戶需求收集」到「部署上線」的完整工作流程
- 採用 **SDD（規格驅動開發）** 方法論：永遠先寫規格，再實作程式碼
- 以 `/dispatch` 指令將複雜任務委派給後台 AI worker，實現並行作業

### 技術棧概覽
- **AI 引擎**：Claude Code（claude-sonnet-4-6 / opus-4-6 / haiku-4-5）
- **MCP 工具**：context7（文件查詢）、playwright（瀏覽器自動化）、icon-generator（圖示生成）
- **版本控制**：Git + GitHub
- **部署目標**：Vercel（主要）、GitHub Pages（靜態展示，選用）
- **作業系統**：Windows 11 Pro（bash shell）

### 當前進度
- Phase 0（環境設置）：**已完成**（3/23 里程碑）
- Phase 1–5：待執行

---

## 二、MVP 功能清單（必要，可測試與驗收）

以下功能為交付最小可用系統的必要條件。

### M1 — 客戶需求訪談模組（Phase 1.1–1.2）
- **M1.1** 執行需求訪談分析，輸出結構化 intake 文件（`docs/intake/`）
- **M1.2** 依需求撰寫完整功能規格文件，包含使用者故事、技術規格、驗收標準（`docs/specs/`）
- **驗收標準**：intake 文件含背景摘要、MVP 清單、風險清單；specs 文件含 AC（Acceptance Criteria）

### M2 — 規格審查與修訂模組（Phase 1.3–1.4）
- **M2.1** 從實作者角度審查規格，標注模糊/矛盾處（`docs/specs/review/`）
- **M2.2** 修訂規格，加上版本號與 changelog，解決所有審查問題
- **驗收標準**：review 文件列出所有問題；最終 spec 含版本號與 resolved changelog

### M3 — Agency OS 核心架構（Phase 2.1）
- **M3.1** 依 `docs/specs/` 實作 Agency OS 主體架構（目錄結構、設定檔、核心模組）
- **驗收標準**：專案可啟動，主要模組可獨立測試

### M4 — 客戶需求收集介面（Phase 2.2）
- **M4.1** 實作 intake form / 需求收集介面（依 `docs/specs/intake.md`）
- **驗收標準**：使用者可輸入需求，系統輸出結構化訪談摘要

### M5 — 任務派遣與追蹤模組（Phase 2.3）
- **M5.1** 實作對應 `/dispatch` 工作流的任務派遣追蹤模組（依 `docs/specs/dispatch.md`）
- **驗收標準**：任務可建立、指派、追蹤狀態（待辦/進行中/完成）

### M6 — 測試套件（Phase 2.4–2.5）
- **M6.1** 撰寫各模組單元測試與整合測試
- **M6.2** 修復測試發現的 bug
- **驗收標準**：測試覆蓋率 ≥ 80%，CI 全數通過

### M7 — 程式碼審查與 QA（Phase 3.1–3.3）
- **M7.1** 執行完整 code review（正確性、安全性、效能、規格符合度）
- **M7.2** 逐條對照驗收標準執行 QA，輸出 pass/fail 報告
- **M7.3** 確認所有測試通過
- **驗收標準**：QA 報告無 critical fail；所有 spec AC 通過

### M8 — 部署至 Vercel（Phase 4.1–4.2）
- **M8.1** Build 確認無錯誤後推送至 GitHub
- **M8.2** 部署至 Vercel 並確認 URL 可正常存取
- **驗收標準**：Vercel 部署成功，生產環境 URL 回應 200

---

## 三、Nice-to-Have 功能清單（可選，不影響 MVP 交付）

| # | 功能 | 對應 Phase | 說明 |
|---|------|-----------|------|
| N1 | GitHub Pages 靜態展示部署 | 4.3 | 靜態展示頁，非主力環境 |
| N2 | 安全審計（OWASP Top 10） | 3.4 | 上線後補強，初期可跳過 |
| N3 | 程式碼重構 | 5.3 | 功能穩定後進行，不改外部行為 |
| N4 | 自動化文件更新（README、API docs） | 5.4 | 提升維護性，非核心功能 |
| N5 | 迭代循環（新需求 → 新 spec 輪次） | 5.2 | 第二輪 SDD 循環，屬持續維護範疇 |
| N6 | 進度摘要自動生成（`/summarize`） | 5.1 | 方便追蹤，但非功能性需求 |

---

## 四、技術風險清單

| # | 風險描述 | 嚴重度 | 緩解策略 |
|---|----------|--------|----------|
| R1 | **高度依賴 Claude Code API**：API 異動、速率限制、帳號問題皆可能中斷全流程 | 🔴 高 | 保留人工介入節點；關鍵流程不完全自動化 |
| R2 | **SDD 流程紀律要求高**：若跳過規格撰寫直接實作，將破壞整個方法論基礎 | 🔴 高 | 在 CLAUDE.md 強制規定「先規格再實作」；dispatch 任務流程中加入 spec gate |
| R3 | **Dispatch worker 輸出品質不穩定**：不同模型（opus/sonnet/haiku）的輸出品質差異大，可能產生不符規格的程式碼 | 🟡 中 | 對關鍵任務指定 opus；加入 review-spec 與 code-review 節點 |
| R4 | **MCP 工具整合可靠性**：playwright、context7 等 MCP 工具版本更新或連線問題 | 🟡 中 | 鎖定 .mcp.json 版本；建立無 MCP 的降級流程 |
| R5 | **Windows 環境相容性**：部分 Unix 指令在 Windows bash 可能行為不同（路徑、換行符等） | 🟡 中 | 統一使用 forward slash；測試在 bash shell 執行；留意 CRLF 問題 |
| R6 | **規格文件與實作分歧**：長時間開發後 spec 與程式碼可能不同步 | 🟡 中 | 每個 Phase 結束前執行 review-spec 對照實作 |
| R7 | **Vercel 部署設定複雜度**：若專案含後端 API，Vercel 環境變數與 serverless function 限制可能導致部署失敗 | 🟢 低 | Phase 4 前確認 Vercel 設定；先做靜態版本驗證 |
| R8 | **Git hook 與通知系統可靠性**：`.claude/hooks/` 通知音效依賴本地環境 | 🟢 低 | 不列為核心功能；失效不影響主流程 |

---

## 五、功能模組複雜度表

| 模組 | Phase | 複雜度 | 說明 |
|------|-------|--------|------|
| 環境設置（Environment Setup） | 0 | 🟢 低 | 已完成；複製設定檔 + git init |
| 客戶需求訪談分析 | 1.1 | 🟢 低 | 純文件生成，本次任務即為範例 |
| 功能規格撰寫 | 1.2 | 🟡 中 | 需涵蓋使用者故事、技術規格、AC |
| 規格審查與修訂 | 1.3–1.4 | 🟡 中 | 跨文件對照分析，需清晰的審查框架 |
| Agency OS 核心架構 | 2.1 | 🔴 高 | 主體架構設計，影響所有後續模組 |
| 客戶需求收集介面 | 2.2 | 🟡 中 | UI + 資料結構；依 spec 實作 |
| 任務派遣追蹤模組 | 2.3 | 🔴 高 | 狀態管理複雜；需整合 /dispatch 工作流 |
| 測試套件 | 2.4 | 🟡 中 | 需覆蓋單元 + 整合測試 |
| Bug 修復 | 2.5 | 🟡 中 | 依實際發現問題而定 |
| 程式碼審查 | 3.1 | 🟡 中 | 人工 + AI 對照規格審查 |
| QA 驗收 | 3.2 | 🟡 中 | 逐條 AC 驗證，輸出 pass/fail |
| 測試執行 | 3.3 | 🟢 低 | 執行現有測試套件 |
| 安全審計 | 3.4 | 🟡 中 | OWASP Top 10 + 依賴掃描 |
| Build + GitHub 推送 | 4.1 | 🟢 低 | 標準化流程 |
| Vercel 部署 | 4.2 | 🟢 低 | 設定正確後為低複雜度 |
| GitHub Pages 部署 | 4.3 | 🟢 低 | 靜態展示，選用 |
| 進度摘要 | 5.1 | 🟢 低 | 文件掃描 + 摘要生成 |
| 迭代循環 | 5.2 | 🟡 中 | 重新進入 SDD 流程 |
| 重構 | 5.3 | 🟡 中 | 需嚴格保持外部行為不變 |
| 文件更新 | 5.4 | 🟢 低 | 文件同步，自動化程度高 |

---

## 六、建議實作優先順序

### 立即執行（Phase 1，當前阻塞點）

```
1.1 → 1.2 → 1.3 → 1.4
intake → specs → review → update-spec
```

> **理由**：SDD 方法論要求所有實作前必須有完整規格。Phase 1 是進入 Phase 2 的硬性前提。

### 第二優先（Phase 2 核心）

```
2.1（核心架構）→ 2.3（dispatch 追蹤）→ 2.2（intake 介面）→ 2.4（測試）→ 2.5（bug fix）
```

> **理由**：架構先行，dispatch 模組是整個 OS 的核心差異化功能，優先於 UI。

### 第三優先（Phase 3 品質確保）

```
3.1（code review）→ 3.3（run tests）→ 3.2（QA check）→ 3.4（security audit，可選）
```

> **理由**：部署前必須通過 QA；安全審計可在 MVP 上線後補做。

### 最後執行（Phase 4–5）

```
4.1 → 4.2（Vercel）→ 4.3（Pages，可選）→ 5.x（迭代維護）
```

---

## 七、下一步行動

| 優先級 | 任務 | Dispatch Alias | 指派模型 |
|--------|------|---------------|----------|
| P0 | 撰寫完整功能規格文件 | `write-spec: agency-os` | opus |
| P1 | 審查規格文件 | `review-spec` | sonnet |
| P2 | 修訂規格文件 | `update-spec` | sonnet |
| P3 | 實作核心架構 | `implement: docs/specs/agency-os.md` | sonnet |
| P4 | 實作 dispatch 追蹤模組 | `add-feature: 任務派遣追蹤模組` | sonnet |

---

*此文件由 `/dispatch "intake"` 自動生成。如有需求變更，請重新執行 `/dispatch "intake: [新需求]"`。*
