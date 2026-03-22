'use strict';

/**
 * 104 外包網 — Public Outsource Listing Scraper
 *
 * Scrapes publicly visible outsource job listings from
 * https://www.104.com.tw/jobs/search/?jobsource=outside
 * — no login, no authenticated pages.
 *
 * @module scrapers/104-outsource
 */

const BASE_URL = 'https://www.104.com.tw';
const LIST_URL = `${BASE_URL}/jobs/search/?jobsource=outside`;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/123.0.0.0 Safari/537.36';

/**
 * Sleeps for a random duration between min and max milliseconds.
 * @param {number} min
 * @param {number} max
 * @returns {Promise<void>}
 */
function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Derives a stable external_id from the job URL.
 * 104 job URLs look like: /job/XXXXXXXX?... or contain a job code.
 * @param {string} url
 * @returns {string}
 */
function deriveExternalId(url) {
  try {
    const u = new URL(url);
    // Match /job/<code> or jobNo=<code>
    const pathMatch = u.pathname.match(/\/job\/([a-z0-9]+)/i);
    if (pathMatch) return `104-${pathMatch[1]}`;
    const jobNo = u.searchParams.get('jobNo');
    if (jobNo) return `104-${jobNo}`;
  } catch (_) {
    // ignore
  }
  return `104-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Scrapes the 104 outsource listing page and extracts job cards.
 * 104 uses a Vue/React SPA; we wait for the job list to appear.
 *
 * @param {import('playwright').Page} page
 * @param {number} pageNum  1-based
 * @returns {Promise<Array<{title:string, url:string, budget_raw:string|null, description:string|null, client_name:string|null, tech_stack:string[]}>>}
 */
async function scrapeListingPage(page, pageNum) {
  const url = pageNum === 1
    ? LIST_URL
    : `${LIST_URL}&page=${pageNum}`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for job list items to appear (SPA may need a moment)
  await page
    .waitForSelector('article.b-block--compress, .job-list-item, [data-v-job-list]', {
      timeout: 10000,
    })
    .catch(() => {}); // proceed even if timeout — evaluate will return []

  const cards = await page.evaluate((baseUrl) => {
    function abs(href) {
      if (!href) return '';
      if (href.startsWith('http')) return href;
      return baseUrl + (href.startsWith('/') ? '' : '/') + href;
    }

    function text(sel, root = document) {
      const el = root.querySelector(sel);
      return el ? el.innerText.trim() : null;
    }

    // 104 uses different selectors across layout versions; try several
    const cardSelectors = [
      'article.b-block--compress',
      '.job-list-item',
      '[data-v-job-list] li',
      'li.b-list__item',
      '.job-summary',
    ];

    let cardEls = [];
    for (const sel of cardSelectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        cardEls = Array.from(found);
        break;
      }
    }

    return cardEls.map((card) => {
      // Title & URL
      const linkEl =
        card.querySelector('a.b-block__anchor') ||
        card.querySelector('a.job-title') ||
        card.querySelector('h2 a') ||
        card.querySelector('a[href*="/job/"]') ||
        card.querySelector('a');

      const title = linkEl ? linkEl.innerText.trim() : null;
      const href = linkEl ? linkEl.getAttribute('href') : null;
      const jobUrl = abs(href);

      // Company / client name
      const client_name =
        text('.b-block__company, .company, .employer, [class*="company"]', card) ||
        null;

      // Salary / budget — 104 shows salary range which maps to budget
      const budget_raw =
        text('.b-tag--salary, .salary, [class*="salary"], .b-tag--pay', card) ||
        null;

      // Short description / excerpt on card
      const description =
        text('.b-block__description, .job-description, .description', card) ||
        null;

      // Tags / skills
      const tagEls = card.querySelectorAll(
        '.b-tag, .tag, [class*="tag"], [class*="skill"]'
      );
      const tech_stack = Array.from(tagEls)
        .map((el) => el.innerText.trim())
        .filter((t) => t && t.length < 50); // skip overly long strings

      return { title, url: jobUrl, budget_raw, description, client_name, tech_stack };
    });
  }, BASE_URL);

  return cards.filter((c) => c.title && c.url);
}

/**
 * Main scrape entry point.
 *
 * @param {import('playwright').Browser} browser
 * @param {number} limit
 * @param {{ delay_min_ms?: number, delay_max_ms?: number }} opts
 * @returns {Promise<object[]>}
 */
async function scrape(browser, limit, opts) {
  const { delay_min_ms = 1500, delay_max_ms = 4000 } = opts || {};

  const results = [];
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'zh-TW',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const page = await context.newPage();

  try {
    let pageNum = 1;
    const maxPages = 10;

    while (results.length < limit && pageNum <= maxPages) {
      let cards;
      try {
        cards = await scrapeListingPage(page, pageNum);
        console.log(`[104-outsource] page ${pageNum}: found ${cards.length} cards`);
      } catch (err) {
        console.error(`[104-outsource] listing page ${pageNum} error: ${err.message}`);
        break;
      }

      if (cards.length === 0) break;

      for (const card of cards) {
        if (results.length >= limit) break;

        results.push({
          external_id: deriveExternalId(card.url),
          source: '104-outsource',
          url: card.url,
          title: card.title,
          description: card.description || null,
          budget_raw: card.budget_raw || null,
          deadline_raw: null, // 104 outsource does not prominently show a deadline
          client_name: card.client_name || null,
          tech_stack: card.tech_stack || [],
        });
      }

      pageNum++;
      if (results.length < limit && pageNum <= maxPages) {
        await randomDelay(delay_min_ms, delay_max_ms);
      }
    }
  } catch (err) {
    console.error(`[104-outsource] unexpected error: ${err.message}`);
  } finally {
    await context.close().catch(() => {});
  }

  console.log(`[104-outsource] scraped ${results.length} leads (limit=${limit})`);
  return results.slice(0, limit);
}

module.exports = { scrape };
