'use strict';

/**
 * PRO360 Public Task List Scraper
 *
 * Scrapes public listings from https://www.pro360.com.tw/tasklist
 * — no login, no authenticated pages.
 *
 * module.exports = { scrape: async function(browser, limit, opts) }
 *   browser  — Playwright Browser instance (caller manages lifecycle)
 *   limit    — maximum number of leads to return
 *   opts     — { delay_min_ms: number, delay_max_ms: number }
 *
 * Returns: Array<LeadObject> matching the leads table schema
 *   { external_id, title, url, budget_raw, deadline_raw,
 *     description, client_name, tech_stack, source }
 */

const BASE_URL = 'https://www.pro360.com.tw';
const LIST_URL = `${BASE_URL}/tasklist`;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/123.0.0.0 Safari/537.36';

/**
 * Sleep for a random duration between min and max milliseconds.
 * @param {number} min
 * @param {number} max
 */
function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the numeric task ID from a PRO360 task URL.
 * e.g. /task/12345  →  '12345'
 * @param {string} href
 * @returns {string|null}
 */
function extractExternalId(href) {
  const m = href && href.match(/\/task\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Scrape a single task detail page and return enriched lead fields.
 * Returns null on error so the caller can skip gracefully.
 *
 * @param {import('playwright').Page} page
 * @param {string} detailUrl
 * @returns {Promise<object|null>}
 */
async function scrapeDetailPage(page, detailUrl) {
  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // PRO360 renders server-side HTML — selectors may need adjustment
    // if the site changes layout. Using broad fallbacks throughout.

    const title = await page
      .$eval('h1.task-title, h1, .task-detail__title', (el) => el.innerText.trim())
      .catch(() => '');

    const description = await page
      .$eval(
        '.task-detail__description, .task-description, [class*="description"]',
        (el) => el.innerText.trim()
      )
      .catch(() => '');

    const budget_raw = await page
      .$eval(
        '.task-detail__budget, [class*="budget"], .price, [class*="price"]',
        (el) => el.innerText.trim()
      )
      .catch(() => '');

    const deadline_raw = await page
      .$eval(
        '.task-detail__deadline, [class*="deadline"], [class*="expire"], [class*="date"]',
        (el) => el.innerText.trim()
      )
      .catch(() => '');

    const client_name = await page
      .$eval(
        '.task-detail__client, [class*="client"], .employer-name, [class*="employer"]',
        (el) => el.innerText.trim()
      )
      .catch(() => '');

    // Tech stack — collect tag/badge elements that represent skills
    const tech_stack = await page
      .$$eval(
        '.task-skills .skill, .tag, [class*="skill"], [class*="tag"]',
        (els) => els.map((el) => el.innerText.trim()).filter(Boolean)
      )
      .catch(() => []);

    return { title, description, budget_raw, deadline_raw, client_name, tech_stack };
  } catch (err) {
    console.warn(`[pro360] detail page error (${detailUrl}): ${err.message}`);
    return null;
  }
}

/**
 * Scrape the PRO360 public task list.
 *
 * @param {import('playwright').Browser} browser
 * @param {number} limit
 * @param {{ delay_min_ms: number, delay_max_ms: number }} opts
 * @returns {Promise<object[]>}
 */
async function scrape(browser, limit, opts) {
  const { delay_min_ms = 1000, delay_max_ms = 3000 } = opts || {};
  const leads = [];

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'zh-TW',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    },
  });

  const page = await context.newPage();

  try {
    let pageNum = 1;

    while (leads.length < limit) {
      const listUrl =
        pageNum === 1 ? LIST_URL : `${LIST_URL}?page=${pageNum}`;

      console.log(`[pro360] fetching list page ${pageNum}: ${listUrl}`);

      try {
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navErr) {
        console.warn(`[pro360] failed to load list page ${pageNum}: ${navErr.message}`);
        break;
      }

      // Collect task links from the listing page
      // PRO360 task cards typically link to /task/<id>
      const taskLinks = await page
        .$$eval('a[href*="/task/"]', (anchors) =>
          [...new Set(anchors.map((a) => a.getAttribute('href')))].filter((h) =>
            /\/task\/\d+/.test(h)
          )
        )
        .catch(() => []);

      if (taskLinks.length === 0) {
        console.log(`[pro360] no task links found on page ${pageNum} — stopping pagination`);
        break;
      }

      for (const href of taskLinks) {
        if (leads.length >= limit) break;

        const external_id = extractExternalId(href);
        const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;

        // Random delay before each detail page request
        await randomDelay(delay_min_ms, delay_max_ms);

        const detail = await scrapeDetailPage(page, url);

        leads.push({
          external_id,
          source: 'pro360',
          url,
          title: (detail && detail.title) || '',
          description: (detail && detail.description) || '',
          budget_raw: (detail && detail.budget_raw) || '',
          deadline_raw: (detail && detail.deadline_raw) || '',
          client_name: (detail && detail.client_name) || '',
          tech_stack: (detail && detail.tech_stack) || [],
        });
      }

      // Check if there is a next page link; stop if not
      const hasNextPage = await page
        .$('a[rel="next"], .pagination .next:not(.disabled), [class*="pagination"] a[href*="page=' + (pageNum + 1) + '"]')
        .then((el) => !!el)
        .catch(() => false);

      if (!hasNextPage) {
        console.log(`[pro360] no next page found after page ${pageNum} — done`);
        break;
      }

      pageNum += 1;
      // Delay between list page navigations
      await randomDelay(delay_min_ms, delay_max_ms);
    }
  } catch (err) {
    console.error(`[pro360] unexpected error: ${err.message}`);
    // Return whatever partial results we have
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  console.log(`[pro360] scraped ${leads.length} leads (limit=${limit})`);
  return leads;
}

module.exports = { scrape };
