# Local AI Freelance Agency OS — 開發路線圖

> **進度摘要：15 / 28 里程碑完成**
> 最後更新：2026-03-22

---

## Phase 1 MVP：接案監控核心

**目標**：能自動抓案件、AI 評分、Telegram 通知、人工決策、Kanban 追蹤。

- [x] **1.1** 建立 Docker Compose 骨架（n8n + Ollama + PostgreSQL + Redis + Scraper + Scorer）
- [x] **1.2** 設計並建立 PostgreSQL schema（leads、projects、kanban_status、agent_logs、quotations、revisions）
- [x] **1.3** 撰寫 PRD 與系統架構文件（`docs/PRD.md`、`docs/architecture.md`）
- [x] **1.4** 撰寫 n8n workflow MVP 規格書（`docs/n8n-workflow-spec.md`）
- [x] **1.5** 實作 Playwright 爬蟲服務，抓取公開案件列表（PRO360 / 出任務）
- [x] **1.6** 實作 Ollama 評分服務（risk_score / fit_score / profit_score）
- [x] **1.7** 建立 n8n 工作流：Scheduler → 爬蟲 → 評分 → 寫入 PostgreSQL
- [x] **1.8** 實作 Telegram Bot：發送案件摘要通知
- [x] **1.9** Telegram Bot 接收回覆：`聯絡報價 / 放棄報價 / 稍後處理`
- [x] **1.10** 建立基本 Kanban 看板（案件狀態流轉）

---

## Phase 2：報價與成案

**目標**：AI 草擬報價、人工審核、成案後自動建立專案資料夾。

- [x] **2.1** 實作 Quotation Assistant（Ollama 生成報價草稿）
- [x] **2.2** Telegram 發送草稿 + 人工核准流程
- [x] **2.3** 實作 Project Bootstrapper：成案後自動建立 `/projects/{id}-{slug}/`
- [x] **2.4** 自動產生專案文件：`README.md`、`brief.md`、`scope.md`、`todo.md`、`client-log.md`
- [x] **2.5** 建立「交付任務」並發送給 Claude Code / Codex

---

## Phase 3：開發執行與驗收

**目標**：Dev Agent 執行開發，客戶回饋轉成修改任務。

- [ ] **3.1** 實作 Dev Agent Dispatcher（將 brief.md 轉發給 Claude Code / Codex）
- [ ] **3.2** 實作 Revision Manager（客戶回饋 → revision-NNN.md）
- [ ] **3.3** Claude Code / Codex 依 md 執行修正
- [ ] **3.4** 修正完成後通知客戶確認流程

---

## Phase 4：Agent 控制面板

**目標**：統一監控所有 agent 狀態與 KPI。

- [ ] **4.1** 實作 Agent Runtime Status 面板（n8n / Ollama / Telegram / Claude Code 狀態）
- [ ] **4.2** Human Approval Queue（待確認項目列表）
- [ ] **4.3** KPI 區塊（新案件數、推薦數、報價數、成交數、轉換率）
- [ ] **4.4** 整合 Paperclip 作為 agent 任務治理層

---

## Phase 5：強化與擴充

**目標**：安全強化、多平台、半自動客戶溝通。

- [ ] **5.1** 防爬蟲偵測強化（User-Agent 輪換、請求節奏控制）
- [ ] **5.2** 多平台擴充（104外包網、Upwork 等公開頁）
- [ ] **5.3** 半自動客戶溝通（AI 草擬 → 人工確認 → 送出）
- [ ] **5.4** SLA 追蹤與版本管理
- [ ] **5.5** CRM 與知識庫（過往案件學習）
- [ ] **5.6** 成本追蹤（Ollama token / API 費用）

---

## Kanban 案件狀態流

```
新抓到 → AI評估中 → 待你決策 → [已放棄]
                              ↓
                           待報價 → 已送報價 → 商談中 → [放棄洽談]
                                                      ↓
                                                   已成交 → 開發中 → 待初審
                                                                      ↓
                                                                 待修正 → 待最終確認 → 已結案
```
