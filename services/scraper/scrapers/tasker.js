'use strict';

/**
 * Tasker (tasker.com.tw) — Public Case Listing Scraper
 *
 * Scrapes publicly visible case listings from
 * https://www.tasker.com.tw/cases/top
 * — no login, no authenticated pages.
 *
 * @module scrapers/tasker
 */

const { getRandomUA } = require('../user-agents');

const BASE_URL = 'https://www.tasker.com.tw';
const LIST_URL = `${BASE_URL}/cases/top`;

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
];

function randomViewport() {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Derive a stable external_id from the Tasker case URL.
 * URL format: /cases/TK26032309GMEF77
 * @param {string} url
 * @returns {string}
 */
function deriveExternalId(url) {
  try {
    const match = new URL(url).pathname.match(/\/cases\/(TK\w+)/i);
    if (match) return `tasker-${match[1]}`;
  } catch (_) {}
  return `tasker-${Date.now()}`;
}

/**
 * Parse the card link text into structured fields.
 *
 * Text parts format (newline-split, trimmed):
 *   [0] title
 *   [1] time ago (e.g. "2分鐘")
 *   [2] budget (e.g. "$5,000")
 *   [3] location (e.g. "台中市" or "可遠端")
 *   [4] deadline (YYYY/MM/DD) — optional
 *   [5..n] description lines, tags, status (ignore "案主活躍", "|", numbers, "搶先提案")
 *
 * @param {string[]} parts
 * @returns {{ title, budget_raw, deadline_raw, location, description, tech_stack }}
 */
function parseCardParts(parts) {
  const title = parts[0] || '';

  // Budget: starts with $
  const budget_raw = parts.find(p => /^\$[\d,]+/.test(p)) || null;

  // Deadline: YYYY/MM/DD pattern
  const deadline_raw = parts.find(p => /^\d{4}\/\d{2}\/\d{2}$/.test(p)) || null;

  // Location: known city patterns or 可遠端
  const location = parts.find(p =>
    /^(台北|台中|台南|高雄|基隆|新北|桃園|新竹|苗栗|彰化|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|澎湖|金門|連江|可遠端)/.test(p)
  ) || null;

  // Noise words to filter out
  const noise = new Set(['搶先提案', '案主活躍於', '人提案中', '|', '急件', '需開立發票']);
  const isNoise = (p) =>
    noise.has(p) ||
    /^\d+$/.test(p) ||
    /^案主活躍/.test(p) ||
    /分鐘前|小時前|天前|秒前|一週前|剛剛|\d+分鐘$|\d+小時$/.test(p);

  // Description: first meaningful line that isn't title/budget/deadline/location/noise
  const skipValues = new Set([title, budget_raw, deadline_raw, location].filter(Boolean));
  const descParts = parts.filter(p =>
    p && !skipValues.has(p) && !isNoise(p) && p.length > 5
  );

  // Split into description (longer lines) and tech_stack (shorter tag-like strings)
  const description = descParts.filter(p => p.length > 20).slice(0, 3).join(' ').trim() || null;
  const tech_stack = descParts.filter(p => p.length <= 20 && p.length > 1);

  return { title, budget_raw, deadline_raw, location, description, tech_stack };
}

/**
 * Scrape the listing page.
 */
async function scrapeListingPage(page, pageNum) {
  const url = pageNum === 1 ? LIST_URL : `${LIST_URL}?page=${pageNum}`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for li-case cards to appear
  await page
    .waitForSelector('.li-case, [class*="li-case"]', { timeout: 10000 })
    .catch(() => {});

  return page.evaluate((baseUrl) => {
    // li-case elements ARE the <a> links themselves
    const linkEls = Array.from(document.querySelectorAll('a[href*="/cases/TK"], a[href*="/cases/"]'))
      .filter(a => a.className && a.className.includes('li-case'));

    // Fallback: find all <a> that look like case links
    const allCaseLinks = linkEls.length > 0 ? linkEls
      : Array.from(document.querySelectorAll('a[href*="/cases/TK"]'));

    const results = [];

    for (const linkEl of allCaseLinks) {
      const href = linkEl.getAttribute('href');
      if (!href) continue;
      const caseUrl = href.startsWith('http') ? href : baseUrl + href;

      const parts = linkEl.innerText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      if (!parts[0]) continue;

      results.push({ url: caseUrl, parts });
    }

    return results;
  }, BASE_URL);
}

/**
 * Main scrape entry point.
 */
async function scrape(browser, limit, opts) {
  const { delay_min_ms = 2000, delay_max_ms = 5000 } = opts || {};

  const results = [];
  const context = await browser.newContext({
    userAgent: getRandomUA(),
    locale: 'zh-TW',
    viewport: randomViewport(),
    extraHTTPHeaders: {
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const page = await context.newPage();

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    let pageNum = 1;
    const maxPages = 5;

    while (results.length < limit && pageNum <= maxPages) {
      let cards;
      try {
        cards = await scrapeListingPage(page, pageNum);
        console.log(`[tasker] page ${pageNum}: found ${cards.length} cards`);
      } catch (err) {
        console.error(`[tasker] listing page ${pageNum} error: ${err.message}`);
        break;
      }

      if (cards.length === 0) break;

      for (const card of cards) {
        if (results.length >= limit) break;

        const { title, budget_raw, deadline_raw, location, description, tech_stack } =
          parseCardParts(card.parts);

        if (!title) continue;

        results.push({
          external_id: deriveExternalId(card.url),
          source: 'tasker',
          url: card.url,
          title,
          description,
          budget_raw,
          deadline_raw,
          client_name: null,
          tech_stack: location ? [location, ...tech_stack] : tech_stack,
        });
      }

      pageNum++;
      if (results.length < limit && pageNum <= maxPages) {
        await randomDelay(delay_min_ms, delay_max_ms);
      }
    }
  } catch (err) {
    console.error(`[tasker] unexpected error: ${err.message}`);
  } finally {
    await context.close().catch(() => {});
  }

  console.log(`[tasker] scraped ${results.length} leads (limit=${limit})`);
  return results.slice(0, limit);
}

module.exports = { scrape };
