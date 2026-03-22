'use strict';

/**
 * Freelancer.com — Public Project Listing Scraper
 *
 * Scrapes publicly visible project listings from
 * https://www.freelancer.com/jobs/
 * — no login, no authenticated pages.
 *
 * @module scrapers/freelancer-tw
 */

const BASE_URL = 'https://www.freelancer.com';
const LIST_URL = `${BASE_URL}/jobs/`;

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
 * Derives a stable external_id from a Freelancer project URL.
 * e.g. /projects/php/build-a-website-123456/ → '123456'
 * @param {string} url
 * @returns {string}
 */
function deriveExternalId(url) {
  try {
    const u = new URL(url);
    // Trailing numeric segment in path
    const numericMatch = u.pathname.match(/-(\d+)\/?$/);
    if (numericMatch) return `fl-${numericMatch[1]}`;
    // Fallback: last non-empty path segment
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length > 0) return `fl-${parts[parts.length - 1]}`;
  } catch (_) {
    // ignore
  }
  return `fl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Scrapes a single Freelancer listing page.
 * Freelancer renders server-side HTML for /jobs/ listing, making it
 * relatively straightforward to parse without waiting for heavy JS.
 *
 * @param {import('playwright').Page} page
 * @param {number} pageNum  1-based
 * @returns {Promise<Array<{title:string, url:string, budget_raw:string|null, description:string|null, tech_stack:string[]}>>}
 */
async function scrapeListingPage(page, pageNum) {
  const url = pageNum === 1
    ? LIST_URL
    : `${LIST_URL}${pageNum}/`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for project list to appear
  await page
    .waitForSelector('.JobSearchCard-item, .project-details, [class*="JobSearchCard"]', {
      timeout: 10000,
    })
    .catch(() => {});

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

    // Freelancer uses BEM-style class names that may change; try several
    const cardSelectors = [
      '.JobSearchCard-item',
      '[class*="JobSearchCard"]',
      '.project-details',
      '.search-result-item',
      'article[class*="project"]',
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
        card.querySelector('.JobSearchCard-primary-heading a') ||
        card.querySelector('h2 a') ||
        card.querySelector('a[href*="/projects/"]') ||
        card.querySelector('a.project-title') ||
        card.querySelector('a');

      const title = linkEl ? linkEl.innerText.trim() : null;
      const href = linkEl ? linkEl.getAttribute('href') : null;
      const projectUrl = abs(href);

      // Budget: Freelancer shows ranges like "$30-250 USD" or "₹600-1500 INR"
      const budget_raw =
        text('.JobSearchCard-secondary-price', card) ||
        text('[class*="budget"]', card) ||
        text('.budget', card) ||
        text('[class*="price"]', card) ||
        null;

      // Description excerpt shown on card
      const description =
        text('.JobSearchCard-primary-description', card) ||
        text('[class*="description"]', card) ||
        text('.project-summary', card) ||
        null;

      // Skills / tags
      const tagEls = card.querySelectorAll(
        '.JobSearchCard-primary-tags a, [class*="skill"], [class*="tag"]'
      );
      const tech_stack = Array.from(tagEls)
        .map((el) => el.innerText.trim())
        .filter((t) => t && t.length < 50);

      return { title, url: projectUrl, budget_raw, description, tech_stack };
    });
  }, BASE_URL);

  // Filter: must have title and a valid /projects/ URL
  return cards.filter((c) => c.title && c.url && c.url.includes('/projects/'));
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
  const { delay_min_ms = 2000, delay_max_ms = 5000 } = opts || {};

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
        console.log(`[freelancer-tw] page ${pageNum}: found ${cards.length} cards`);
      } catch (err) {
        console.error(`[freelancer-tw] listing page ${pageNum} error: ${err.message}`);
        break;
      }

      if (cards.length === 0) break;

      for (const card of cards) {
        if (results.length >= limit) break;

        results.push({
          external_id: deriveExternalId(card.url),
          source: 'freelancer-tw',
          url: card.url,
          title: card.title,
          description: card.description || null,
          budget_raw: card.budget_raw || null,
          deadline_raw: null, // not shown on Freelancer listing cards
          client_name: null,  // Freelancer does not show client name on listing
          tech_stack: card.tech_stack || [],
        });
      }

      pageNum++;
      if (results.length < limit && pageNum <= maxPages) {
        await randomDelay(delay_min_ms, delay_max_ms);
      }
    }
  } catch (err) {
    console.error(`[freelancer-tw] unexpected error: ${err.message}`);
  } finally {
    await context.close().catch(() => {});
  }

  console.log(`[freelancer-tw] scraped ${results.length} leads (limit=${limit})`);
  return results.slice(0, limit);
}

module.exports = { scrape };
