# Dispatch Alias List — Local-AI-Freelance-Agency-OS

Append the following YAML block to `~/.dispatch/config.yaml`.

```yaml
# ============================================================
# Local-AI-Freelance-Agency-OS — Dispatch Alias List
# Project: AI-powered freelance agency OS (SDD methodology)
# Workflow: client intake → spec → dispatch → code → review → deploy
# Model guide: haiku=low-complexity, sonnet=medium, opus=high
# ============================================================

aliases:

  # ----------------------------------------------------------
  # GROUP 1: Project Initialization
  # ----------------------------------------------------------

  init-env:
    model: sonnet
    prompt: |
      按照 CLAUDE.md 的「New Project Initialization Checklist」和
      新專案的啟動流程.md，依序完成環境初始化：
      1. 確認 .mcp.json 已掛載通用 MCP 工具
      2. 確認 .claude/commands/ 已載入 deploy_vercel.md、depoly_github_page.md、update.md
      3. 確認 git 已初始化，user.name="dev"，user.email="dev@example.com"
      4. 回報每個步驟的完成狀態。

  init-git:
    model: haiku
    prompt: |
      初始化 git 專案（若尚未初始化）。
      設定 git config user.name="dev" 和 user.email="dev@example.com"（若尚未設定）。
      列出目前 git status 和最近一次 commit。

  first-commit:
    model: haiku
    prompt: |
      將所有未追蹤的檔案加入 staging area，
      執行第一次 commit，訊息為 "chore: first commit — initialize project environment"。
      回報 commit hash 和 git log 最近三筆。

  setup-mcp:
    model: sonnet
    prompt: |
      從 C:\Users\xx\Desktop\cc\toymarketpalce\claude_code_toy_marketplace-initial\.mcp.json
      複製 MCP 設定到本專案的 .mcp.json。
      確認工具清單完整，回報已掛載的 MCP server 名稱。

  load-commands:
    model: haiku
    prompt: |
      從以下路徑複製 slash commands 到 .claude/commands/：
      - deploy_vercel.md
      - depoly_github_page.md
      - update.md
      確認三個檔案都已存在，回報結果。

  # ----------------------------------------------------------
  # GROUP 2: Spec / SDD Workflow
  # ----------------------------------------------------------

  intake:
    model: opus
    prompt: |
      你是一位資深的 freelance 專案經理。
      閱讀客戶需求（若有提供文件或描述），進行客戶需求訪談分析：
      1. 整理功能需求清單（分 MVP 與 nice-to-have）
      2. 識別技術限制與風險
      3. 估算任務複雜度（低/中/高）
      4. 輸出結構化的客戶需求摘要到 docs/intake/[專案名].md

  write-spec:
    model: opus
    prompt: |
      遵循 SDD（Spec-Driven Development）流程，根據 docs/intake/ 的需求摘要，
      撰寫完整的功能規格文件到 docs/specs/[功能名].md，內容包含：
      - 目標與範圍
      - 使用者故事（User Stories）
      - 功能規格（Functional Spec）
      - 技術規格（Technical Spec）：資料結構、API 介面、元件設計
      - 驗收標準（Acceptance Criteria）
      規格必須足夠詳細，讓 sonnet 模型能直接依規格實作，無需猜測。

  review-spec:
    model: sonnet
    prompt: |
      閱讀 docs/specs/ 中最新的規格文件，從實作者的角度檢查：
      1. 是否有模糊或矛盾的描述
      2. 技術規格是否可行
      3. 驗收標準是否可測試
      列出所有需要澄清或修正的問題，輸出到 docs/specs/review/[規格名]-review.md。

  update-spec:
    model: sonnet
    prompt: |
      根據 docs/specs/review/ 的審查意見，更新對應的規格文件。
      在文件頂部加上版本號和修改摘要（changelog block）。
      確保所有審查問題都已解決或已標注待議。

  # ----------------------------------------------------------
  # GROUP 3: Development
  # ----------------------------------------------------------

  implement:
    model: sonnet
    prompt: |
      閱讀 docs/specs/ 中指定的規格文件（若未指定，讀取最新的）。
      嚴格依照規格實作功能，不添加規格外的功能。
      實作完成後回報：已建立/修改的檔案清單、與規格的對應關係、尚未實作的部分。

  fix-bug:
    model: sonnet
    prompt: |
      分析問題描述（或錯誤訊息），定位 bug 根因。
      修復 bug，說明根因、修復方式、以及如何避免類似問題。
      不要修改與 bug 無關的程式碼。

  write-tests:
    model: sonnet
    prompt: |
      閱讀對應的功能實作檔案和規格的驗收標準，
      撰寫測試（單元測試 + 關鍵整合測試）。
      確保測試覆蓋所有驗收標準，回報測試涵蓋率和測試結果。

  refactor:
    model: opus
    prompt: |
      閱讀指定的程式碼區域，進行重構：
      1. 識別重複邏輯、過長函式、不清晰的命名
      2. 提出重構計畫，等待確認後再執行
      3. 重構後確保所有測試仍通過
      4. 回報重構前後的差異摘要。
      原則：最小改動，不改變外部行為。

  add-feature:
    model: sonnet
    prompt: |
      根據指定的功能需求（若無規格文件，先詢問是否需要建立規格），
      實作新功能。遵循現有程式碼風格和專案結構。
      完成後列出所有變更的檔案。

  debug:
    model: sonnet
    prompt: |
      讀取錯誤訊息、日誌、或問題描述。
      系統性地診斷問題：檢查相關檔案、追蹤資料流、識別假設。
      提出修復方案，確認後再執行修復。

  # ----------------------------------------------------------
  # GROUP 4: Review & QA
  # ----------------------------------------------------------

  code-review:
    model: opus
    prompt: |
      對 git diff HEAD~1 或指定的 PR 進行完整程式碼審查：
      1. 正確性（邏輯錯誤、邊界情況）
      2. 安全性（OWASP Top 10、輸入驗證）
      3. 效能（明顯瓶頸）
      4. 可維護性（命名、結構、重複邏輯）
      5. 規格符合度（對照 docs/specs/）
      輸出結構化的審查報告到 docs/reviews/[日期]-review.md，分嚴重/警告/建議三級。

  qa-check:
    model: sonnet
    prompt: |
      對照 docs/specs/ 中的驗收標準，逐條檢查目前實作：
      - [pass] 已實作且符合標準
      - [fail] 未實作或不符合標準（附說明）
      - [skip] 不適用
      輸出 QA 報告到 docs/qa/[日期]-qa.md，並列出需修復的項目清單。

  run-tests:
    model: haiku
    prompt: |
      執行專案的測試套件（npm test 或對應指令）。
      回報測試結果：通過/失敗數量、失敗的測試名稱和錯誤訊息。
      若有失敗，不要自動修復，只回報問題。

  security-audit:
    model: opus
    prompt: |
      對專案程式碼進行安全審計：
      1. 掃描 OWASP Top 10 風險
      2. 檢查依賴套件的已知漏洞（npm audit 或類似工具）
      3. 審查環境變數和金鑰管理
      4. 檢查 API 端點的認證和授權
      輸出安全審計報告到 docs/security/[日期]-audit.md。

  # ----------------------------------------------------------
  # GROUP 5: Deployment
  # ----------------------------------------------------------

  deploy-vercel:
    model: sonnet
    prompt: |
      執行 /deploy_vercel 指令，將專案部署到 Vercel。
      確認部署成功，回報部署 URL 和部署狀態。
      若部署失敗，分析錯誤原因並提出修復方案。

  deploy-pages:
    model: sonnet
    prompt: |
      執行 /depoly_github_page 指令，將專案部署到 GitHub Pages。
      確認部署成功，回報 Pages URL 和部署狀態。
      若部署失敗，分析錯誤原因並提出修復方案。

  update-push:
    model: haiku
    prompt: |
      執行 /update 指令：將目前所有變更 commit 並推送到 GitHub，
      若有連接 Vercel 則同步觸發部署。
      回報 commit hash、推送狀態、部署觸發狀態。

  build-check:
    model: haiku
    prompt: |
      執行 build 指令（npm run build 或對應指令），
      確認 build 成功無錯誤。
      若有錯誤，回報完整錯誤訊息，不要自動修復。

  # ----------------------------------------------------------
  # GROUP 6: Utility / Project Management
  # ----------------------------------------------------------

  status:
    model: haiku
    prompt: |
      回報專案目前狀態：
      1. git status（未提交的變更）
      2. 最近 5 筆 commit
      3. docs/specs/ 中的規格文件清單
      4. 是否有待處理的 review 或 QA 報告
      格式簡潔，用清單呈現。

  list-tasks:
    model: haiku
    prompt: |
      列出 .dispatch/tasks/ 目錄下所有任務，
      包含任務名稱、狀態（進行中/完成/待處理）、和最後更新時間。
      格式化為清晰的表格。

  cleanup:
    model: haiku
    prompt: |
      清理專案中的暫存檔案：
      - 刪除 node_modules 中不必要的快取
      - 清理 build 輸出目錄（dist/、.next/、build/）
      - 列出被清理的項目和釋放的空間
      不要刪除任何源碼或文件檔案。

  summarize:
    model: sonnet
    prompt: |
      閱讀專案的所有文件（CLAUDE.md、docs/specs/、docs/reviews/、git log），
      生成一份專案進度摘要，包含：
      - 已完成的功能
      - 進行中的工作
      - 待處理的問題
      - 下一步建議行動
      輸出到 docs/progress/[日期]-summary.md。

  estimate:
    model: opus
    prompt: |
      閱讀指定的規格文件或功能需求，
      從技術實作角度估算：
      1. 需要實作的主要任務和子任務
      2. 每個任務的複雜度（低/中/高）
      3. 潛在風險和依賴關係
      4. 建議的實作順序
      不提供時間估算，只提供複雜度和優先順序分析。

  docs-update:
    model: sonnet
    prompt: |
      根據最新的程式碼變更（git diff），
      更新對應的文件：README、API 文件、或規格文件。
      確保文件與實作保持一致，標注所有有意義的變更。
```
