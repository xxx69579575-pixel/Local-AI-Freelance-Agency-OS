# Phase 1.6 — Ollama 評分服務

- [x] Read `docs/PRD.md` and `docs/n8n-workflow-spec.md` for scorer API contract and scoring fields
- [x] Read `db/init.sql` to confirm scoring fields: risk_score, fit_score, expected_profit_score, recommended_action, reason_summary, scored_at, ollama_model
- [x] Create `services/scorer/` directory structure
- [x] Write `services/scorer/package.json` — deps: express, node-fetch, dotenv
- [x] Write `services/scorer/Dockerfile` — node:20-slim base
- [x] Write `services/scorer/server.js`:
  - POST /score: accepts { lead_id, title, description, budget_raw, tech_stack } → builds prompt → calls Ollama llama3.2 → parses JSON response → returns { risk_score(1-10), fit_score(1-10), profit_score(1-10), recommended_action, reason_summary }
  - GET /health
  - Ollama base URL from env OLLAMA_BASE_URL (default http://ollama:11434)
- [x] Write scoring prompt template in `services/scorer/prompt.js` — structured prompt that forces JSON output with all required fields
- [x] Update `docker-compose.yml` to add scorer service (service name: ollama-scorer, port 3002, depends_on ollama) — renamed existing `scorer` → `ollama-scorer`, added port 3002, removed unused POSTGRES_* env vars
- [x] Write summary to `.dispatch/tasks/phase16-scorer/output.md`
