# Phase 1.5 — 出任務 (Chutask) Scraper Module

- [x] Read `docs/PRD.md` and `docs/n8n-workflow-spec.md` for lead data structure and context
- [x] Read `db/init.sql` to confirm leads table fields (external_id, title, url, budget_raw, deadline_raw, description, client_name, source, tech_stack)
- [x] Implement `services/scraper/scrapers/chutask.js`:
  - export async function `scrape(browser, limit, opts)` where opts = { delay_min_ms, delay_max_ms }
  - Navigate to 出任務 public task list (https://www.chutask.com.tw/tasks with ?page=N pagination)
  - For each listing (up to limit): extract external_id, title, url, budget_raw, deadline_raw, description, client_name, tech_stack
  - Add random delay between requests (between delay_min_ms and delay_max_ms)
  - Return array of lead objects with source='chutask'
  - Handle errors gracefully (return partial results on failure)
  - Created directory services/scraper/scrapers/ (did not exist)
- [x] Write summary to `.dispatch/tasks/phase15-chutask/output.md`
