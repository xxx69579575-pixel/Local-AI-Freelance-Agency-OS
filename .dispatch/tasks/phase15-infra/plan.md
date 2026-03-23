# Phase 1.5 — Scraper Service Infrastructure

- [x] Create `services/scraper/scrapers/` directory (mkdir -p)
- [x] Write `services/scraper/package.json` — deps: express, playwright, pg, dotenv, uuid
- [x] Write `services/scraper/Dockerfile` — node:20-slim, playwright chromium install
- [x] Write `services/scraper/.dockerignore`
- [x] Write `services/scraper/server.js` — Express app: POST /scrape → dynamic require(`./scrapers/${source}`) → call scrape(browser, limit, opts) → return JSON; GET /health
- [x] Read `docker-compose.yml` then append scraper service (image build from services/scraper, port 3001, depends_on postgres, env DB_URL) — service already existed; added port 3001, DB_URL env, and postgres healthcheck dependency
- [x] Write summary to `.dispatch/tasks/phase15-infra/output.md`
