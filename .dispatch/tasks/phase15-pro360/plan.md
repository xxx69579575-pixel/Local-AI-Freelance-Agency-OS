# Phase 1.5 — PRO360 Scraper Module

- [x] Read `docs/PRD.md` and `docs/n8n-workflow-spec.md` for lead data structure and context
- [x] Read `db/init.sql` to confirm leads table fields (external_id, title, url, budget_raw, deadline_raw, description, client_name, source, tech_stack)
- [x] Implement `services/scraper/scrapers/pro360.js`:
  - export async function `scrape(browser, limit, opts)` where opts = { delay_min_ms, delay_max_ms }
  - Navigate to PRO360 public task list (https://www.pro360.com.tw/tasklist)
  - For each listing (up to limit): extract external_id, title, url, budget_raw, deadline_raw, description, client_name
  - Add random delay between requests (between delay_min_ms and delay_max_ms)
  - Return array of lead objects with source='pro360'
  - Handle errors gracefully (return partial results on failure)
- [x] Write summary to `.dispatch/tasks/phase15-pro360/output.md`
