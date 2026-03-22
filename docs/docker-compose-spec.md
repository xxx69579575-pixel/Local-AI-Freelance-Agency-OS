# Docker Compose 架構規格 — Local AI Freelance Agency OS

> **版本**：v1.0
> **日期**：2026-03-22

---

## 1. 服務拓樸

```
┌─────────────────────────────────────────────────────────────────┐
│                        agency-net (bridge)                      │
│                                                                 │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│   │   n8n    │   │  ollama  │   │ postgres │   │  redis   │   │
│   │  :5678   │   │  :11434  │   │  :5432   │   │  :6379   │   │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│         │               │                                       │
│   ┌──────────┐   ┌──────────┐                                  │
│   │ scraper  │   │  scorer  │                                  │
│   │  :3001   │   │  :3002   │                                  │
│   └──────────┘   └──────────┘                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
    [對外暴露]
    localhost:5678 (n8n UI)
```

---

## 2. `docker-compose.yml`

```yaml
version: "3.9"

networks:
  agency-net:
    driver: bridge

volumes:
  n8n_data:
  ollama_data:
  postgres_data:
  redis_data:

services:

  # ─── n8n ──────────────────────────────────────────────────────
  n8n:
    image: n8nio/n8n:latest
    container_name: agency-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=${N8N_HOST:-0.0.0.0}
      - N8N_PORT=5678
      - N8N_PROTOCOL=${N8N_PROTOCOL:-http}
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=${POSTGRES_DB}
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - QUEUE_BULL_REDIS_HOST=redis
      - QUEUE_BULL_REDIS_PORT=6379
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - agency-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # ─── Ollama ───────────────────────────────────────────────────
  ollama:
    image: ollama/ollama:latest
    container_name: agency-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - agency-net
    # GPU 支援（可選，需要 nvidia container toolkit）
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  # ─── PostgreSQL ───────────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    container_name: agency-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - agency-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Redis ────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: agency-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - agency-net
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Scraper Service ──────────────────────────────────────────
  scraper:
    build:
      context: ./services/scraper
      dockerfile: Dockerfile
    container_name: agency-scraper
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
    networks:
      - agency-net
    depends_on:
      - redis

  # ─── Ollama Scorer Service ────────────────────────────────────
  scorer:
    build:
      context: ./services/scorer
      dockerfile: Dockerfile
    container_name: agency-scorer
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3002
      - OLLAMA_BASE_URL=http://ollama:11434
      - OLLAMA_MODEL=${OLLAMA_MODEL:-llama3.2}
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    networks:
      - agency-net
    depends_on:
      - ollama
      postgres:
        condition: service_healthy
```

---

## 3. `.env.example`

```env
# ── n8n ──────────────────────────────────────────────────
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=changeme_n8n
N8N_ENCRYPTION_KEY=changeme_32_chars_random_string

# ── PostgreSQL ───────────────────────────────────────────
POSTGRES_DB=agency_os
POSTGRES_USER=agency_user
POSTGRES_PASSWORD=changeme_postgres

# ── Redis ────────────────────────────────────────────────
REDIS_PASSWORD=changeme_redis

# ── Telegram ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_personal_chat_id
TELEGRAM_WEBHOOK_SECRET=changeme_webhook_secret

# ── Ollama ───────────────────────────────────────────────
OLLAMA_MODEL=llama3.2
# OLLAMA_MODEL=llama3.1:8b  # 較大模型，效果更好

# ── Scraper ──────────────────────────────────────────────
SCRAPER_REQUEST_DELAY_MIN=3000
SCRAPER_REQUEST_DELAY_MAX=10000
```

---

## 4. 目錄結構

```
Local-AI-Freelance-Agency-OS/
├── docker-compose.yml
├── .env                        ← 不提交 git
├── .env.example                ← 提交 git
│
├── db/
│   └── init.sql                ← PostgreSQL 初始化腳本
│
├── services/
│   ├── scraper/                ← Playwright 爬蟲服務
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js
│   │       ├── scrapers/
│   │       │   ├── pro360.js
│   │       │   └── chutask.js
│   │       └── utils/
│   │           └── rate-limiter.js
│   │
│   └── scorer/                 ← Ollama 評分服務
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── index.js
│           ├── scorer.js       ← Ollama API 呼叫
│           └── prompts/
│               ├── score.txt   ← 評分 prompt 模板
│               └── quote.txt   ← 報價草稿 prompt 模板
│
├── n8n-workflows/              ← n8n workflow JSON exports
│   ├── WF-01-lead-scraper.json
│   ├── WF-02-telegram-notifier.json
│   └── WF-03-decision-handler.json
│
├── projects/                   ← 成案後自動建立的專案目錄
│   └── .gitkeep
│
└── docs/
    ├── PRD.md
    ├── architecture.md
    ├── db-schema.md
    ├── n8n-workflow-spec.md
    └── docker-compose-spec.md
```

---

## 5. 啟動流程

```bash
# 1. 複製環境變數
cp .env.example .env
# 編輯 .env，填入真實的 Token 和密碼

# 2. 啟動所有服務
docker-compose up -d

# 3. 等待 postgres 就緒後，初始化 DB schema
# (init.sql 會在 postgres 第一次啟動時自動執行)

# 4. 拉取 Ollama 模型
docker exec -it agency-ollama ollama pull llama3.2

# 5. 開啟 n8n 介面
# http://localhost:5678

# 6. 匯入 workflow JSON
# n8n UI → Workflows → Import from File

# 7. 確認 Telegram Bot Webhook 設定
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=http://your-server:5678/webhook/telegram-decision"
```

---

## 6. 健康檢查

```bash
# 確認所有服務狀態
docker-compose ps

# n8n
curl http://localhost:5678/healthz

# Ollama
curl http://localhost:11434/api/tags

# PostgreSQL
docker exec agency-postgres pg_isready -U agency_user

# Redis
docker exec agency-redis redis-cli -a ${REDIS_PASSWORD} ping

# Scraper
curl http://localhost:3001/health

# Scorer
curl http://localhost:3002/health
```
