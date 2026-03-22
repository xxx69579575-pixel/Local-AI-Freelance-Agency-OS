# PRD — Local AI Freelance Agency OS

> **版本**：v1.0
> **日期**：2026-03-22
> **狀態**：草稿

---

## 1. 專案目標

打造一套在本地運行的 AI 接案營運系統，自動監控公開接案資訊、評估案件價值、通知接案者決策、協助建立專案資料夾與交付流程，並提供 agent 監控看板。

### 核心原則

- **人工決策不可跳過**：報價送出、客戶溝通均需人工確認
- **僅抓公開頁**：不碰登入後頁面，符合平台條款
- **本地 LLM 優先**：Ollama 本地模型，不外送資料
- **SDD 規格驅動**：先有規格再寫程式

---

## 2. 使用者故事

| ID | 角色 | 故事 | 優先級 |
|----|------|------|--------|
| US-01 | 接案者 | 定時收到 Telegram 通知「今日新案件」 | P0 |
| US-02 | 接案者 | 看到每個案件的 AI 評分（風險/適合度/利潤）後決定要不要報價 | P0 |
| US-03 | 接案者 | 在 Telegram 點一個按鈕就能啟動報價流程 | P0 |
| US-04 | 接案者 | AI 產出報價草稿，我審核後才送出 | P1 |
| US-05 | 接案者 | 成交後系統自動建立專案工作區 | P1 |
| US-06 | 接案者 | 客戶回饋自動整理成修改單 | P2 |
| US-07 | 接案者 | 一眼看到所有 agent 是否正常運作 | P2 |

---

## 3. 系統邊界

### 系統做的事

- 定時抓取公開案件列表與詳情頁
- Ollama 本地評分（risk / fit / profit）
- Telegram Bot 推播通知、接收人工回覆
- 根據人工決策觸發後續流程
- 建立專案目錄與文件
- 整理客戶回饋為 markdown
- 監控 agent 狀態與 KPI 看板

### 系統不做的事

- 自動登入任何平台
- 自動送出報價（必須人工確認）
- 自動與客戶溝通（AI 草擬，人工確認才發）
- 儲存平台帳號密碼

---

## 4. 功能模組

### 4.1 Lead Collector（採集層）

- **觸發**：n8n Scheduler，每小時一次
- **資料來源**：PRO360 公開案件列表、出任務公開頁
- **技術**：Playwright 抓動態頁 + trafilatura 抽取文字
- **輸出**：結構化 JSON，寫入 PostgreSQL `leads` 表

### 4.2 Lead Scorer（AI 判斷層）

- **模型**：Ollama llama3.2（本地）
- **輸入**：案件原始資料
- **輸出欄位**：

  | 欄位 | 型別 | 說明 |
  |------|------|------|
  | title | string | 案件標題 |
  | source | string | 來源平台 |
  | budget_estimate | string | 預估預算 |
  | deadline | string | 截止日期 |
  | tech_stack | string[] | 技術棧 |
  | risk_score | 1–10 | 風險分數 |
  | fit_score | 1–10 | 適合度分數 |
  | expected_profit_score | 1–10 | 預期利潤分數 |
  | recommended_action | string | 建議行動 |
  | reason_summary | string | 摘要說明 |

### 4.3 Decision Bot（決策與通知層）

- **Telegram Bot** 推播案件摘要
- **人工選項**：
  - `聯絡報價` → 觸發報價流程
  - `放棄報價` → 更新狀態為 `已放棄`
  - `稍後處理` → 保持 `待你決策`
- **n8n Webhook** 接收回覆並更新案件狀態

### 4.4 Quotation Assistant（報價層）

- Ollama 產出報價草稿
- Telegram 發送草稿，等待人工核准
- **人工核准後才送出**（或複製後自行送出）

### 4.5 Project Bootstrapper（成案層）

成交後自動建立：

```
/projects/{project_id}-{slug}/
├── README.md       ← 專案概覽
├── brief.md        ← 需求摘要
├── scope.md        ← 交付範圍
├── todo.md         ← 任務清單
└── client-log.md   ← 客戶溝通紀錄
```

### 4.6 Dev Agent Dispatcher（開發執行層）

- 建立「交付任務」，提供 `brief.md` / `scope.md` / `todo.md`
- 可對接 Claude Code / VS Code / Codex
- 保留人工審核與 git 控制

### 4.7 Revision Manager（修改管理層）

- 客戶回饋進入 inbox
- Ollama 整理為 `revision-NNN.md`
- Claude Code / Codex 依 md 執行修正
- 修正完成後人工確認才通知客戶

### 4.8 Agent Control Dashboard（控制面板層）

- Kanban 看板（案件狀態流轉）
- Agent Runtime Status（n8n / Ollama / Telegram / Claude Code 狀態）
- Human Approval Queue（待確認項目）
- KPI 區塊（新案件數、推薦數、報價數、成交數、轉換率）

---

## 5. 非功能需求

| 類型 | 需求 |
|------|------|
| 隱私 | 所有 LLM 推理在本地完成，不外送原始資料 |
| 可靠性 | n8n scheduler 失敗自動重試 3 次 |
| 擴充性 | 新平台只需新增 scraper module |
| 日誌 | 所有 agent 操作寫入 `agent_logs` 表 |
| 速率控制 | Playwright 請求間隔 3–10 秒隨機 |

---

## 6. 里程碑

| Phase | 目標 | 里程碑數 |
|-------|------|---------|
| Phase 1 MVP | 接案監控核心 | 10 |
| Phase 2 | 報價與成案 | 5 |
| Phase 3 | 開發執行與驗收 | 4 |
| Phase 4 | Agent 控制面板 | 4 |
| Phase 5 | 強化與擴充 | 6 |

詳見 `ROADMAP.md`。

---

## 7. 風險與限制

| 風險 | 說明 | 對策 |
|------|------|------|
| PRO360 條款 | 禁止未經書面同意使用自動化系統 | 只抓公開頁，不登入，不自動送報價 |
| 平台封鎖 | 頻繁請求觸發風控 | User-Agent 輪換、隨機間隔、限制頻率 |
| LLM 錯誤報價 | Ollama 可能生成不合理內容 | 必加人工核准步驟 |
| 自動溝通風險 | 客戶商談需真人介入 | 商談中狀態轉人工處理 |
