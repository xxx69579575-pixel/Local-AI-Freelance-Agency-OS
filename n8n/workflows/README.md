# n8n Workflow Imports — Local AI Freelance Agency OS

Phase 1 MVP contains 3 workflows. Import them in the order listed.

## Workflows

| File | ID | Trigger | Purpose |
|------|----|---------|---------|
| `WF-01-lead-scraper.json` | WF-01 | Cron (every hour, Asia/Taipei) | Scrape pro360 + chutask → score → notify queue |
| `WF-02-telegram-notifier.json` | WF-02 | Schedule (every 5 min) | Poll Redis queue → send Telegram inline-keyboard cards |
| `WF-03-decision-handler.json` | WF-03 | Webhook POST `/webhook/telegram-decision` | Route quote / reject / later → update DB + reply Telegram |

---

## Import Instructions

1. Start n8n: `docker compose up -d n8n`
2. Open http://localhost:5678 and log in
3. Go to **Workflows → Import from File**
4. Import each `.json` file in order: WF-01 → WF-02 → WF-03
5. Configure credentials (see below)
6. Activate each workflow

---

## Required n8n Credentials

Create these credential entries in **Settings → Credentials** before activating workflows.

### 1. Postgres — "Agency Postgres"

| Field | Value |
|-------|-------|
| Host | `postgres` |
| Port | `5432` |
| Database | `agency_os` (= `POSTGRES_DB` in `.env`) |
| User | value of `POSTGRES_USER` in `.env` |
| Password | value of `POSTGRES_PASSWORD` in `.env` |
| SSL | Off |

### 2. Redis — "Agency Redis"

| Field | Value |
|-------|-------|
| Host | `redis` |
| Port | `6379` |
| Password | value of `REDIS_PASSWORD` in `.env` |

> After creating each credential, open each workflow node that references it and select the credential by name.

---

## Required Environment Variables in n8n Container

These variables are read directly with `$env.*` in expression nodes. Add them to the `n8n` service in `docker-compose.yml` or the `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_personal_chat_id_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## Service Endpoint Notes

| Service | Hostname in workflows | Notes |
|---------|-----------------------|-------|
| Playwright scraper | `http://scraper:3001` | docker-compose service: `scraper` |
| Ollama scorer | `http://scorer:3002` | docker-compose service: `scorer` (spec may say `ollama-scorer` — use `scorer`) |
| Telegram Bot API | `https://api.telegram.org/bot${TOKEN}/...` | External HTTPS, accessed from n8n container |
| PostgreSQL | via n8n credential (hostname: `postgres`) | |
| Redis | via n8n credential (hostname: `redis`) | |

---

## Credential Placeholder IDs

The JSON files contain placeholder credential IDs (`POSTGRES_CREDENTIAL_ID`, `REDIS_CREDENTIAL_ID`). After import, n8n will prompt you to set credentials on each node that requires them. The credential names (`Agency Postgres`, `Agency Redis`) are pre-filled as hints.

---

## WF-03 Webhook URL

After importing and activating WF-03, the webhook listens at:

```
http://localhost:5678/webhook/telegram-decision
```

Configure your Telegram Bot to POST callback queries to this URL (via a small relay or ngrok during development). The expected payload format:

```json
{ "action": "quote|reject|later", "lead_id": 42, "chat_id": 123456, "message_id": 99 }
```

Or the native Telegram `callback_query` webhook format is also supported directly.

---

## Activation Order

1. Activate **WF-03** first (webhook needs to be registered before Telegram sends callbacks)
2. Activate **WF-02** (starts polling Redis notify queue every 5 min)
3. Activate **WF-01** last (starts scraping and feeding the pipeline)
