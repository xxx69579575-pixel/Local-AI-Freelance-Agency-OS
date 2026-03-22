# Local AI Freelance Agency OS — 開發路線圖

> **進度摘要：16 / 23 里程碑完成**
>
> 最後更新：2026-03-22 | 方法論：SDD（規格驅動開發）

---

## 如何自動更新此文件

每完成一個里程碑：
1. 將對應的 `- [ ]` 改為 `- [x]`
2. 更新頂部的「進度摘要」數字（例如 `3 / 23 里程碑完成`）
3. 執行 `/dispatch "update-push: 更新 ROADMAP.md 進度"` 推送至 GitHub

或直接執行：`/dispatch "summarize"` — 讓 dispatch worker 自動掃描所有文件並更新進度摘要。

---

## Phase 0：環境設置（Environment Setup）

**目標**：確保開發環境完整，所有工具、指令、版本控制皆就緒。

- [x] **0.1** 確認 `.mcp.json` 已掛載通用 MCP 工具（context7、playwright、icon-generator）
  → `/dispatch "init-env"`
- [x] **0.2** 確認 `.claude/commands/` 已載入三個 slash commands（`deploy_vercel.md`、`depoly_github_page.md`、`update.md`）
  → `/dispatch "load-commands"`
- [x] **0.3** 確認 git 已初始化，`user.name="dev"`，`user.email="dev@example.com"`，並完成 first commit
  → `/dispatch "init-git"` → `/dispatch "first-commit"`

---

## Phase 1：客戶需求訪談與規格（Client Intake & Spec）

**目標**：依 SDD 流程，在寫任何程式碼之前，先將需求轉化為可測試的規格文件。

- [x] **1.1** 訪談分析客戶需求，整理 MVP 功能清單與技術風險，輸出至 `docs/intake/`
  → `/dispatch "intake: [描述客戶需求或貼上需求文件]"`
- [x] **1.2** 依需求摘要撰寫完整功能規格（含使用者故事、技術規格、驗收標準），輸出至 `docs/specs/`
  → `/dispatch "write-spec: [指定功能名稱]"`
- [x] **1.3** 從實作者角度審查規格文件，標注模糊或矛盾之處，輸出至 `docs/specs/review/`
  → `/dispatch "review-spec"`
- [x] **1.4** 根據審查意見修訂規格，加上版本號與 changelog，確保所有審查問題已解決
  → `/dispatch "update-spec"`

---

## Phase 2：開發實作（Development）

**目標**：嚴格依照規格實作功能，不超出規格範圍，保持程式碼品質。

- [x] **2.1** 依 `docs/specs/` 規格實作核心功能（Agency OS 主體架構）
  → `/dispatch "implement: [指定規格檔案路徑]"`
- [x] **2.2** 實作客戶需求訪談模組（intake form / 需求收集介面）
  → `/dispatch "add-feature: 客戶需求訪談模組，參考 docs/specs/intake.md"`
- [x] **2.3** 實作任務派遣與追蹤模組（對應 /dispatch 工作流）
  → `/dispatch "add-feature: 任務派遣追蹤模組，參考 docs/specs/dispatch.md"`
- [x] **2.4** 撰寫各功能模組的單元測試與整合測試
  → `/dispatch "write-tests"`
- [x] **2.5** 修復開發過程中發現的 bug（118/118 測試通過，無需修復）
  → `/dispatch "fix-bug: [描述 bug 或貼上錯誤訊息]"`

---

## Phase 3：審查與品質確保（Review & QA）

**目標**：確保實作符合規格、安全無虞、測試全部通過。

- [x] **3.1** 執行完整程式碼審查（正確性、安全性、效能、規格符合度），輸出至 `docs/reviews/`
  → `/dispatch "code-review"`
- [x] **3.2** 逐條對照驗收標準執行 QA 檢查，輸出 pass/fail 報告至 `docs/qa/`
  → `/dispatch "qa-check"`
- [x] **3.3** 執行測試套件，確認所有測試通過
  → `/dispatch "run-tests"`
- [x] **3.4** 執行安全審計（OWASP Top 10、依賴漏洞、API 認證），輸出至 `docs/security/`
  → `/dispatch "security-audit"`

---

## Phase 4：部署（Deployment）

**目標**：將專案成功部署至生產環境，確認服務正常運作。

- [ ] **4.1** 執行 build 確認無錯誤後，推送所有變更至 GitHub
  → `/dispatch "build-check"` → `/dispatch "update-push"`
- [ ] **4.2** 部署至 Vercel（主要生產環境），確認部署 URL 可正常存取
  → `/dispatch "deploy-vercel"`
- [ ] **4.3** （選用）部署靜態展示頁面至 GitHub Pages
  → `/dispatch "deploy-pages"`

---

## Phase 5：迭代與維護（Iteration & Maintenance）

**目標**：持續追蹤進度、回應新需求、保持文件與程式碼同步。

- [ ] **5.1** 生成專案進度摘要，包含已完成功能、待處理問題、下一步行動
  → `/dispatch "summarize"`
- [ ] **5.2** 根據使用者反饋或新需求，補充/修訂規格文件，進入下一輪 SDD 循環
  → `/dispatch "intake: [新需求描述]"` → `/dispatch "write-spec"`
- [ ] **5.3** 針對已上線功能進行重構，提升可維護性（不改變外部行為）
  → `/dispatch "refactor: [指定重構範圍]"`
- [ ] **5.4** 更新 README、API 文件，確保文件與最新實作一致
  → `/dispatch "docs-update"`

---

## 快速參考：Dispatch Alias 一覽

| Alias | 模型 | 用途 |
|---|---|---|
| `init-env` | sonnet | 環境初始化（MCP + commands + git）|
| `init-git` | haiku | git 設定 |
| `first-commit` | haiku | 初始 commit |
| `load-commands` | haiku | 載入 slash commands |
| `intake` | opus | 客戶需求訪談分析 |
| `write-spec` | opus | 撰寫功能規格文件 |
| `review-spec` | sonnet | 審查規格文件 |
| `update-spec` | sonnet | 修訂規格文件 |
| `implement` | sonnet | 依規格實作功能 |
| `add-feature` | sonnet | 新增功能 |
| `fix-bug` | sonnet | 修復 bug |
| `debug` | sonnet | 系統性診斷問題 |
| `write-tests` | sonnet | 撰寫測試 |
| `refactor` | opus | 重構程式碼 |
| `code-review` | opus | 程式碼審查 |
| `qa-check` | sonnet | QA 驗收檢查 |
| `run-tests` | haiku | 執行測試套件 |
| `security-audit` | opus | 安全審計 |
| `build-check` | haiku | build 確認 |
| `deploy-vercel` | sonnet | 部署至 Vercel |
| `deploy-pages` | sonnet | 部署至 GitHub Pages |
| `update-push` | haiku | commit + push + 觸發部署 |
| `summarize` | sonnet | 生成進度摘要 |
| `docs-update` | sonnet | 更新文件 |
| `status` | haiku | 回報專案現況 |
| `estimate` | opus | 任務複雜度估算 |

---

*此文件由 `/dispatch "dev-roadmap"` 自動生成。每個里程碑完成後請手動勾選，或執行 `/dispatch "summarize"` 更新進度。*
