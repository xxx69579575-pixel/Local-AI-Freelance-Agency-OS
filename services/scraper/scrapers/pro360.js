'use strict';

/**
 * PRO360 Public Case List Scraper
 *
 * Scrapes publicly visible case requests from
 * https://www.pro360.com.tw/case/subgenre/<slug>
 * — no login, no authenticated pages.
 *
 * Targets tech-relevant subgenres:
 *   - software_development（網頁 程式類）
 *   - it（IT相關服務類）
 *
 * @module scrapers/pro360
 */

const { getRandomUA } = require('../user-agents');

const BASE_URL = 'https://www.pro360.com.tw';

// Tech-relevant subgenres to scrape
const TARGET_SUBGENRES = [
  'software_development',
  'it',
];

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
 * Extract external ID from a /case/request/<id> URL.
 * @param {string} url
 * @returns {string}
 */
function extractExternalId(url) {
  const m = url && url.match(/\/case\/request\/(\d+)/);
  return m ? `pro360-${m[1]}` : `pro360-${Date.now()}`;
}

/**
 * Parse a card's text parts into structured fields.
 * Card text format (newline-separated):
 *   title, client_name, location, description/details, time, ...
 */
function parseCardText(parts) {
  const title = parts[0] || '';
  const client_name = parts[1] || null;

  // Location: matches city patterns like "台北市 信義區" or "可遠端"
  let location = null;
  let descStart = 2;
  if (parts[2] && /市|縣|區|可遠端|遠端/.test(parts[2])) {
    location = parts[2];
    descStart = 3;
  }

  // Description: collect lines until we hit "搶先接洽" or time indicators
  const descLines = [];
  for (let i = descStart; i < parts.length; i++) {
    const p = parts[i];
    if (!p || p === '搶先接洽' || p === '我要接單' || p === '找專家') break;
    if (/\d+秒前|\d+分鐘前|\d+小時前|\d+天前|剛剛|一週前/.test(p)) break;
    descLines.push(p);
  }
  const description = descLines.join(' ').trim() || null;

  return { title, client_name, location, description };
}

/**
 * Scrape one subgenre listing page.
 * @param {import('playwright').Page} page
 * @param {string} subgenre
 * @param {number} limit
 * @param {number[]} delay
 * @returns {Promise<object[]>}
 */
async function scrapeSubgenre(page, subgenre, limit, [delayMin, delayMax]) {
  const results = [];
  let pageNum = 1;
  const maxPages = 3;

  while (results.length < limit && pageNum <= maxPages) {
    const url = pageNum === 1
      ? `${BASE_URL}/case/subgenre/${subgenre}`
      : `${BASE_URL}/case/subgenre/${subgenre}?page=${pageNum}`;

    console.log(`[pro360] fetching ${subgenre} page ${pageNum}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500); // Wait for React to render
      // Guard: if no cards appear within 5s, skip this page
      await page.waitForSelector('[class*="request_card"]', { timeout: 5000 })
        .catch(() => console.warn(`[pro360] no cards found on ${url}, skipping`));
    } catch (err) {
      console.warn(`[pro360] failed to load ${url}: ${err.message}`);
      break;
    }

    const cards = await Promise.race([
      page.evaluate((baseUrl) => {
        const cardEls = document.querySelectorAll('[class*="request_card"]');
        const seen = new Set();
        const results = [];

        for (const card of cardEls) {
          // Get the case request link
          const linkEl = card.querySelector('a[href*="/case/request/"]');
          if (!linkEl) continue;

          const href = linkEl.getAttribute('href');
          const requestUrl = href.startsWith('http') ? href : baseUrl + href;
          if (seen.has(requestUrl)) continue;
          seen.add(requestUrl);

          // Parse card text
          const fullText = card.innerText || '';
          const parts = fullText.split('\n').map(s => s.trim()).filter(Boolean);

          results.push({ url: requestUrl, parts });
        }

        return results;
      }, BASE_URL),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('evaluate timeout')), 10000)
      ),
    ]).catch(err => {
      console.warn(`[pro360] evaluate error on ${subgenre} page ${pageNum}: ${err.message}`);
      return [];
    });

    if (cards.length === 0) {
      console.log(`[pro360] no cards found on ${subgenre} page ${pageNum}`);
      break;
    }

    for (const card of cards) {
      if (results.length >= limit) break;
      const { title, client_name, location, description } = parseCardText(card.parts);
      if (!title) continue;

      results.push({
        external_id: extractExternalId(card.url),
        source: 'pro360',
        url: card.url,
        title,
        description,
        budget_raw: null, // Not shown on listing page
        deadline_raw: null,
        client_name,
        tech_stack: location ? [location] : [],
      });
    }

    pageNum++;
    if (results.length < limit && pageNum <= maxPages) {
      await randomDelay(delayMin, delayMax);
    }
  }

  return results;
}

/**
 * Main scrape entry point.
 */
async function scrape(browser, limit, opts) {
  const { delay_min_ms = 2000, delay_max_ms = 5000 } = opts || {};
  const perSubgenre = Math.ceil(limit / TARGET_SUBGENRES.length);

  const context = await browser.newContext({
    userAgent: getRandomUA(),
    locale: 'zh-TW',
    viewport: randomViewport(),
    extraHTTPHeaders: {
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000); // 15s max for any page operation incl. evaluate

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const allResults = [];
  const seen = new Set();

  try {
    for (const subgenre of TARGET_SUBGENRES) {
      if (allResults.length >= limit) break;

      const leads = await scrapeSubgenre(
        page,
        subgenre,
        perSubgenre,
        [delay_min_ms, delay_max_ms]
      );

      for (const lead of leads) {
        if (!seen.has(lead.url)) {
          seen.add(lead.url);
          allResults.push(lead);
        }
      }

      if (TARGET_SUBGENRES.indexOf(subgenre) < TARGET_SUBGENRES.length - 1) {
        await randomDelay(delay_min_ms, delay_max_ms);
      }
    }
  } catch (err) {
    console.error(`[pro360] unexpected error: ${err.message}`);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  console.log(`[pro360] scraped ${allResults.length} leads (limit=${limit})`);
  return allResults.slice(0, limit);
}

module.exports = { scrape };
