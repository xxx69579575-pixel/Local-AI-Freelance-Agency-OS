# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Local AI Freelance Agency OS** — 本地 AI 接案營運系統。
自動監控公開接案資訊、AI 評分、Telegram 通知決策、自動建立專案資料夾與交付流程，並提供 Agent 監控看板。

- GitHub: https://github.com/xxx69579575-pixel/Local-AI-Freelance-Agency-OS
- 需求原文: `read 這才是本專案的原貌.txt`
- 開發方法論: **SDD（Spec-Driven Development）** — 先讀規格再寫 code

## 系統架構

```
採集層      n8n Scheduler → Playwright → trafilatura
AI 判斷層   Ollama（本地 LLM，llama3.2）
決策層      Telegram Bot（人工確認節點）
資料層      PostgreSQL + Redis
控制面板    Agent Control Dashboard（Kanban + 狀態監控）
開發執行    Claude Code / Codex（收到 brief.md 後執行）
部署        Docker Compose（本地運行）
```

## 核心子系統

| 子系統 | 功能 |
|--------|------|
| Lead Collector | Playwright 抓公開案件頁面 |
| Lead Scorer | Ollama 評分（risk/fit/profit） |
| Decision Bot | Telegram 通知 + 人工回覆 |
| Quotation Assistant | AI 草稿 + 人工審核後送出 |
| Project Bootstrapper | 成案後自動建資料夾與文件 |
| Dev Agent Dispatcher | 把任務交給 Claude Code / Codex |
| Revision Manager | 客戶回饋 → revision.md → AI 修正 |
| Agent Control Dashboard | Kanban + agent 狀態面板 |

## 技術棧

- **n8n** — 工作流編排（主引擎）
- **Ollama** — 本地 LLM（llama3.2，案件評分與生成）
- **Playwright** — 動態頁面爬蟲
- **trafilatura** — 內容抽取（Python）
- **Telegram Bot API** — 人機互動
- **PostgreSQL** — 主資料庫
- **Redis** — 快取 / 佇列
- **Paperclip** — Agent 任務監控與治理
- **Docker Compose** — 本地服務編排
- **Claude Code / Codex** — 開發執行 agent

## 目錄結構（目標）

```
Local-AI-Freelance-Agency-OS/
├── docker-compose.yml          # 服務編排
├── .env.example                # 環境變數範本
├── docs/
│   ├── PRD.md                  # 產品需求文件
│   ├── architecture.md         # 系統架構圖
│   ├── db-schema.md            # 資料庫 schema
│   ├── n8n-workflow-spec.md    # n8n 工作流規格
│   └── specs/                  # 各子系統規格
├── services/
│   ├── telegram-bot/           # Telegram Bot 服務
│   ├── scraper/                # Playwright 爬蟲服務
│   ├── scorer/                 # Ollama 評分服務
│   └── dashboard/              # Agent 控制面板
├── n8n/
│   └── workflows/              # n8n workflow JSON 匯出
├── db/
│   └── migrations/             # 資料庫遷移腳本
└── projects/                   # 成案後自動建立的專案資料夾
```

## 開發流程（SDD）

1. 讀規格 → `docs/specs/<module>.md`
2. 建立計畫 → `/dispatch "implement: <spec>"`
3. 實作 → 依規格，不超範圍
4. 測試 → 確認 AC 全部通過
5. 更新文件 → `/dispatch "docs-update"`

## 重要限制

- **PRO360 條款**：只抓公開頁面，不做登入後自動操作，不自動送報價
- **人工審核節點**：報價、客戶溝通、git push 均需人工確認
- **本地部署**：不部署到 Vercel，Docker Compose 本地運行
