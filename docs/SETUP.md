# Local AI Freelance Agency OS — 安裝與使用手冊

> 本文件帶你從零開始，完整啟動整個系統。

---

## 目錄

1. [系統需求](#1-系統需求)
2. [服務架構總覽](#2-服務架構總覽)
3. [第一步：取得 Telegram Bot Token](#3-第一步取得-telegram-bot-token)
4. [第二步：建立 .env 設定檔](#4-第二步建立-env-設定檔)
5. [第三步：啟動 Docker 服務](#5-第三步啟動-docker-服務)
6. [第四步：初始化資料庫](#6-第四步初始化資料庫)
7. [第五步：安裝 Ollama 模型](#7-第五步安裝-ollama-模型)
8. [第六步：驗證所有服務](#8-第六步驗證所有服務)
9. [日常使用流程](#9-日常使用流程)
10. [各服務功能說明](#10-各服務功能說明)
11. [Telegram 指令完整清單](#11-telegram-指令完整清單)
12. [Dashboard 使用說明](#12-dashboard-使用說明)
13. [常見問題](#13-常見問題)

---

## 1. 系統需求

| 項目 | 最低需求 | 建議 |
|------|----------|------|
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | Windows 11 |
| RAM | 8 GB | 16 GB（Ollama 跑 llama3.2 需要） |
| 磁碟 | 20 GB 可用空間 | 40 GB（模型檔案約 4 GB） |
| Docker Desktop | 4.x 以上 | 最新版 |
| 網路 | 可連外（下載映像檔） | — |

**必須預先安裝：**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — 啟動所有服務
- [Claude Code CLI](https://claude.ai/code) — Dev Agent Dispatcher 用（接案執行階段才需要）

---

## 2. 服務架構總覽

啟動後共有 13 個 Docker 容器：

| 服務 | Port | 功能 |
|------|------|------|
| n8n | 5678 | 工作流排程（爬蟲觸發） |
| postgres | 5432 | 主資料庫 |
| redis | 6379 | 快取 / Bot 暫存 |
| ollama | 11434 | 本地 LLM（llama3.2） |
| scraper | 3001 | Playwright 爬蟲（PRO360、104、Freelancer） |
| ollama-scorer | 3002 | AI 評分服務 |
| dashboard | 3003 | Kanban 控制面板 |
| telegram-bot | 3004 | Telegram 通知與互動 |
| bootstrapper | 3005 | 成案後自動建立專案資料夾 |
| dev-dispatcher | 3006 | 派發 Claude Code 任務 |
| revision-manager | 3007 | 客戶修改回饋管理 |
| paperclip | 3008 | Agent 任務治理 |
| comm-assistant | 3009 | AI 草擬客戶溝通 |
| knowledge-base | 3010 | CRM 知識庫 |

---

## 3. 第一步：取得 Telegram Bot Token

1. 打開 Telegram，搜尋 **@BotFather**
2. 發送 `/newbot`
3. 輸入 Bot 名稱（例如 `My Agency OS`）
4. 輸入 Bot 用戶名（必須以 `bot` 結尾，例如 `myagencyos_bot`）
5. BotFather 會給你一個 Token，格式類似：
   ```
   1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```
   **複製並保存這個 Token**

6. 取得你的個人 Chat ID：
   - 搜尋 **@userinfobot**，發送任何訊息
   - 它會回傳你的 `Id`（數字），這就是 `TELEGRAM_CHAT_ID`

---

## 4. 第二步：建立 .env 設定檔

在專案根目錄複製範本：

```bash
cp .env.example .env
```

然後編輯 `.env`，填入真實值：

```env
# ── n8n 控制台登入帳密 ────────────────────────────────────
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=你的n8n密碼（自訂）
N8N_ENCRYPTION_KEY=隨機32字元字串（可用 openssl rand -hex 16 產生）

# ── PostgreSQL ───────────────────────────────────────────
POSTGRES_DB=agency_os
POSTGRES_USER=agency_user
POSTGRES_PASSWORD=你的資料庫密碼（自訂）

# ── Redis ────────────────────────────────────────────────
REDIS_PASSWORD=你的Redis密碼（自訂）

# ── Telegram ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=步驟3取得的Token
TELEGRAM_CHAT_ID=步驟3取得的Chat ID

# ── Ollama 模型 ───────────────────────────────────────────
OLLAMA_MODEL=llama3.2
```

> **重要**：`.env` 已在 `.gitignore` 中，不會被 commit 到 GitHub。

---

## 5. 第三步：啟動 Docker 服務

確認 Docker Desktop 已啟動，然後在專案根目錄執行：

```bash
# 第一次啟動（下載映像檔，需要幾分鐘）
docker compose up -d --build

# 查看所有服務狀態
docker compose ps
```

正常狀態下所有服務應顯示 `Up` 或 `running`：

```
NAME                    STATUS
agency-postgres         Up (healthy)
agency-redis            Up (healthy)
agency-ollama           Up
agency-n8n              Up
agency-scraper          Up
agency-ollama-scorer    Up
agency-dashboard        Up
agency-telegram-bot     Up
...
```

> 第一次建置約需 5–10 分鐘（需下載 Docker 映像檔）

---

## 6. 第四步：初始化資料庫

PostgreSQL 啟動時會自動執行 `db/init.sql` 建立基本 schema。
接著需要手動跑追加的 migration：

```bash
# SLA 追蹤欄位
docker exec -i agency-postgres psql -U agency_user -d agency_os \
  < db/migrations/002_sla_tracking.sql

# CRM 知識庫
docker exec -i agency-postgres psql -U agency_user -d agency_os \
  < db/migrations/003_knowledge_base.sql

# 成本追蹤
docker exec -i agency-postgres psql -U agency_user -d agency_os \
  < db/migrations/004_cost_tracking.sql
```

確認成功：
```bash
docker exec agency-postgres psql -U agency_user -d agency_os \
  -c "\dt" 2>/dev/null
```

應看到：`leads`、`projects`、`quotations`、`agent_logs`、`kanban_status`、`tasks`、`knowledge_base`、`cost_logs` 等資料表。

---

## 7. 第五步：安裝 Ollama 模型

```bash
# 進入 Ollama 容器並下載模型（約 2 GB，需要幾分鐘）
docker exec -it agency-ollama ollama pull llama3.2

# 確認模型已安裝
docker exec agency-ollama ollama list
```

測試模型可用：
```bash
curl http://localhost:11434/api/tags
# 應看到 llama3.2 在清單中
```

---

## 8. 第六步：驗證所有服務

逐一確認各服務健康狀態：

```bash
# 一鍵檢查所有服務
curl -s http://localhost:3003/api/agent-status | python -m json.tool
```

或個別確認：

| 服務 | 確認指令 |
|------|---------|
| Dashboard | 瀏覽器開啟 http://localhost:3003 |
| n8n | 瀏覽器開啟 http://localhost:5678 |
| Scraper | `curl http://localhost:3001/health` |
| Scorer | `curl http://localhost:3002/health` |
| Telegram Bot | 在 Telegram 對 Bot 發送 `/start` |

---

## 9. 日常使用流程

### 自動流程（系統自動進行）

```
每小時（n8n Scheduler 觸發）
  ↓
Scraper 抓取 PRO360 / 出任務 / 104 外包網 / Freelancer 公開案件
  ↓
Scorer 用 llama3.2 評分（risk / fit / profit，各 1–10 分）
  ↓
高分案件（fit ≥ 7）→ Telegram 通知你
  ↓
你回覆：聯絡報價 / 放棄報價 / 稍後處理
```

### 人工決策點

收到 Telegram 通知後，你有三個選擇：

- **聯絡報價** → 系統生成報價草稿 → 你審核後手動送出
- **放棄報價** → 案件標記放棄
- **稍後處理** → 案件留在 Kanban「待你決策」欄

### 成案後流程

```
你確認成案
  ↓
Bootstrapper 自動建立 /projects/{id}-{slug}/ 資料夾
  （含 README.md / brief.md / scope.md / todo.md / client-log.md）
  ↓
Dev Dispatcher 讀取 brief.md → 呼叫 Claude Code 執行開發
  ↓
開發完成 → Telegram 通知你確認交付
  ↓
你確認 → kanban_status 更新為「待最終確認」
你要修改 → Revision Manager 建立 revision-NNN.md → 重新執行
```

---

## 10. 各服務功能說明

### Scraper（爬蟲服務）
- 支援平台：PRO360、出任務、104外包網、Freelancer.com
- 只抓公開頁面，不做登入操作
- 內建防偵測：UA 輪換 + 請求節奏 + stealth 設定

手動觸發爬蟲：
```bash
curl -X POST http://localhost:3001/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "pro360", "limit": 20}'

# 或所有平台一起跑
curl -X POST http://localhost:3001/scrape-all \
  -H "Content-Type: application/json" \
  -d '{"limitPerSource": 10}'
```

### Scorer（AI 評分）
- 使用 llama3.2 評估每個案件
- 評分維度：`risk_score`（風險）、`fit_score`（適合度）、`profit_score`（利潤潛力）
- 整合知識庫：用過往成功案件作為 few-shot 範例

### Dashboard（控制面板）
- 網址：http://localhost:3003
- 功能：Kanban 看板 / KPI 統計 / 人工審核佇列 / Agent 狀態 / 任務治理 / 知識庫

### Telegram Bot
- 接收案件通知
- 確認報價/放棄
- `/reply` 草擬客戶回覆（不自動送出）
- SLA 逾期提醒（每日一次彙整）

---

## 11. Telegram 指令完整清單

| 指令 | 說明 |
|------|------|
| `/start` | 確認 Bot 連線正常 |
| `/reply <project_id> <訊息>` | AI 草擬客戶回覆，等你確認後記錄 |
| _(inline keyboard)_ `聯絡報價` | 觸發報價草稿生成 |
| _(inline keyboard)_ `放棄報價` | 標記案件放棄 |
| _(inline keyboard)_ `稍後處理` | 案件留待處理 |
| _(inline keyboard)_ `確認交付` | 案件進入待最終確認 |
| _(inline keyboard)_ `需要修改` | 輸入修改意見，建立 revision |

---

## 12. Dashboard 使用說明

開啟 http://localhost:3003

### Kanban 看板（主頁）
- 案件狀態卡片，可拖曳（或透過 Telegram 操作）
- 橙色左框 = SLA 警示（48小時內到期）
- 紅色左框 = SLA 逾期
- 頂部 KPI：新案件 / AI推薦 / 報價 / 成交 / 轉換率 / 本月tokens

### 人工審核佇列（header 橙色badge）
- 待審核報價草稿（確認 / 退回修改）
- 待初審專案
- Agent 派工確認

### Agent 狀態
- 即時顯示各服務 online/offline/error
- 每 30 秒自動刷新

### 任務治理
- 所有 Agent 任務列表
- 可手動 Cancel / Retry

### 知識庫
- 過往成功/失敗案件瀏覽
- 標籤篩選
- 勝率統計

---

## 13. 常見問題

**Q: `docker compose up` 後某服務一直 Restarting？**
```bash
docker logs agency-<服務名稱> --tail 50
```
最常見原因：`.env` 缺少必要變數，或 postgres 還沒 healthy 就有其他服務先啟動。

**Q: Telegram Bot 沒有回應？**
- 確認 `TELEGRAM_BOT_TOKEN` 正確
- 確認 `TELEGRAM_CHAT_ID` 是你自己的 ID（數字）
- 檢查 Bot 日誌：`docker logs agency-telegram-bot`

**Q: Ollama 評分很慢？**
- llama3.2 在 CPU 模式下每次評分約 30–60 秒，屬正常
- 如有 NVIDIA GPU，取消 `docker-compose.yml` 中 GPU 相關的 `# deploy:` 註解

**Q: 第一次爬蟲沒有結果？**
- 用瀏覽器手動開啟 PRO360 確認公開頁面可訪問
- 查看爬蟲日誌：`docker logs agency-scraper`
- PRO360 前端結構可能更新，需修改 `services/scraper/scrapers/pro360.js` 的 selector

**Q: 如何重置資料庫？**
```bash
docker compose down -v   # 刪除所有 volume（包含資料）
docker compose up -d --build
# 重新跑 migrations
```

**Q: 如何升級？**
```bash
git pull
docker compose up -d --build
```

---

## 端口對照快速查詢

| 網址 | 服務 |
|------|------|
| http://localhost:3003 | Dashboard（主控台） |
| http://localhost:5678 | n8n 工作流編輯器 |
| http://localhost:11434 | Ollama API |
| http://localhost:5432 | PostgreSQL（需 DB 客戶端） |

---

*有問題請查看各服務 Docker logs，或在 GitHub 開 Issue。*
