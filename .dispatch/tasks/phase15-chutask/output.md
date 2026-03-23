# Phase 1.5 — 出任務 (Chutask) Scraper — Output Summary

**Completed:** 2026-03-22

## File Created

`services/scraper/scrapers/chutask.js`

## What Was Built

A Playwright-based scraper for the 出任務 (chutask.com.tw) public task listing platform.

### Function Signature

```js
const { scrape } = require('./scrapers/chutask');
const leads = await scrape(browser, limit, { delay_min_ms, delay_max_ms });
```

### Return Schema (per item)

| Field         | Source                  | Notes                                      |
|---------------|-------------------------|--------------------------------------------|
| `external_id` | Derived from URL path   | Falls back to slugified title              |
| `source`      | Hardcoded               | Always `'chutask'`                         |
| `url`         | Listing page anchor     | Absolute URL                               |
| `title`       | Listing card            |                                            |
| `description` | Detail page             | `null` if unavailable                      |
| `budget_raw`  | Listing + detail page   | Raw text (e.g. `NT$1,000~5,000`)           |
| `deadline_raw`| Listing + detail page   | Raw text                                   |
| `client_name` | Listing + detail page   | `null` if not shown publicly               |
| `tech_stack`  | Tags (listing + detail) | `string[]`                                 |

### Key Design Decisions

1. **Two-phase scraping**: listing page for card data → detail page per task for description and enrichment.
2. **Random delay** between every navigation (`delay_min_ms`..`delay_max_ms` ms).
3. **Pagination**: increments `?page=N` until no cards found or limit reached, capped at 10 pages.
4. **Partial results on error**: returns whatever was collected before any exception.
5. **No login**: only public pages accessed. Browser context uses realistic `zh-TW` locale + User-Agent.
6. **Selector resilience**: multiple CSS selector fallbacks tried in order for each field.

### Public URL Used

`https://www.chutask.com.tw/tasks` (with `?page=N` for pagination)

## Constraints Respected

- No login / authenticated page access
- Random delay between navigations
- Handles pagination up to `limit` items
- Realistic User-Agent (Chrome 122 on Windows)
- Graceful error handling — returns partial results
