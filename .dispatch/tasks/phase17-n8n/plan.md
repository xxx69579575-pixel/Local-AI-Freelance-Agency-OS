# Phase 1.7 — n8n Workflow JSON

- [x] Read `docs/n8n-workflow-spec.md` thoroughly for all 3 workflow specs (WF-01, WF-02, WF-03) including node details and expressions
- [x] Read `docker-compose.yml` to confirm service names (scraper:3001, ollama-scorer:3002, postgres, redis) — NOTE: docker-compose names scorer service `scorer`, not `ollama-scorer`; workflows use `scorer:3002`
- [x] Create `n8n/workflows/` directory
- [x] Write `n8n/workflows/WF-01-lead-scraper.json` — n8n workflow: Cron (every hour) → Set sources → Split → HTTP scraper → IF success → Postgres check duplicate → Postgres INSERT → HTTP scorer → Postgres UPDATE score → Redis RPUSH notify queue
- [x] Write `n8n/workflows/WF-02-telegram-notifier.json` — n8n workflow: Interval (5min) → Postgres SELECT pending_decision leads → Split → Telegram sendMessage with inline keyboard
- [x] Write `n8n/workflows/WF-03-decision-handler.json` — n8n workflow: Webhook (POST /decision) → Switch on action → Postgres UPDATE status → conditional follow-up
- [x] Write `n8n/workflows/README.md` — import instructions and environment variable requirements
- [x] Write summary to `.dispatch/tasks/phase17-n8n/output.md`
