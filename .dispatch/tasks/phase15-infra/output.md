# Phase 1.5 — Scraper Service Infrastructure: Output Summary

## Files Created

| Path | Purpose |
|------|---------|
| `services/scraper/scrapers/` | Empty directory; scraper modules (pro360.js, chutask.js) go here |
| `services/scraper/package.json` | Node deps: express, playwright, pg, dotenv, uuid |
| `services/scraper/Dockerfile` | node:20-slim base; installs Chromium via `npx playwright install chromium --with-deps` |
| `services/scraper/.dockerignore` | Excludes node_modules, .env, *.md |
| `services/scraper/server.js` | Express skeleton — see API below |

## Files Modified

| Path | Change |
|------|--------|
| `docker-compose.yml` | Scraper service already present; added `ports: 3001:3001`, `DB_URL` env var, `depends_on: postgres (service_healthy)` and `redis (service_healthy)` |

## API

### GET /health
Returns `{ status: "ok", service: "scraper", ts: "..." }`.

### POST /scrape
```json
{
  "source": "pro360",
  "limit": 20,
  "delay_min_ms": 1000,
  "delay_max_ms": 3000
}
```
Dynamically `require`s `./scrapers/${source}.js` and calls `module.scrape(browser, limit, opts)`.
Returns `{ source, count, results }`.

The `browser` passed in is a `playwright.chromium` instance (headless). Each scraper module receives it and is responsible for opening/closing its own pages.

## Next Steps for Other Workers
- Implement `services/scraper/scrapers/pro360.js` — export `async function scrape(browser, limit, opts)`
- Implement `services/scraper/scrapers/chutask.js` — same interface
- Both modules must respect `opts.delay_min_ms` / `opts.delay_max_ms` between requests (PRO360 TOS: public pages only, no login automation)
