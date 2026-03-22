'use strict';

/**
 * 出任務 (chutask.com.tw) — Public Task Listing Scraper
 *
 * Scrapes publicly visible task listings only.
 * Does NOT perform login or access authenticated pages.
 *
 * @module scrapers/chutask
 */

const BASE_URL = 'https://www.chutask.com.tw';
const LISTING_URL = `${BASE_URL}/tasks`;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/122.0.0.0 Safari/537.36';

/**
 * Returns a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleeps for a random duration between delay_min_ms and delay_max_ms.
 * @param {number} delay_min_ms
 * @param {number} delay_max_ms
 * @returns {Promise<void>}
 */
function randomDelay(delay_min_ms, delay_max_ms) {
  const ms = randomInt(delay_min_ms, delay_max_ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Derives a stable external_id from the task URL or a fallback.
 * Prefers numeric IDs found in the path (e.g. /tasks/12345).
 * @param {string} url
 * @param {string} [fallbackTitle]
 * @returns {string}
 */
function deriveExternalId(url, fallbackTitle) {
  try {
    const pathname = new URL(url).pathname;
    // Match trailing numeric or alphanumeric segment: /tasks/12345
    const match = pathname.match(/\/(\w+)\/?$/);
    if (match && match[1] && match[1] !== 'tasks') return match[1];
  } catch (_) {
    // ignore
  }
  // Fallback: slugify from title
  if (fallbackTitle) {
    return fallbackTitle
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
  return `chutask-${Date.now()}`;
}

/**
 * Scrapes a single task detail page and returns enriched fields.
 * Returns an empty object on any error (caller uses listing-page data as fallback).
 *
 * @param {import('playwright').Page} page
 * @param {string} url
 * @returns {Promise<Partial<LeadRecord>>}
 */
async function scrapeDetailPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const detail = await page.evaluate(() => {
      const text = (sel, root = document) => {
        const el = root.querySelector(sel);
        return el ? el.innerText.trim() : null;
      };

      // ── Description ─────────────────────────────────────────────────────────
      // Try common selectors for task body/description
      const description =
        text('.task-description') ||
        text('.task-content') ||
        text('[data-testid="task-description"]') ||
        text('.job-description') ||
        text('.content-body') ||
        text('article') ||
        null;

      // ── Budget ───────────────────────────────────────────────────────────────
      const budget_raw =
        text('.task-budget') ||
        text('[data-testid="budget"]') ||
        text('.budget') ||
        text('.price') ||
        null;

      // ── Deadline ─────────────────────────────────────────────────────────────
      const deadline_raw =
        text('.task-deadline') ||
        text('[data-testid="deadline"]') ||
        text('.deadline') ||
        text('.due-date') ||
        null;

      // ── Client / Poster ──────────────────────────────────────────────────────
      const client_name =
        text('.task-poster-name') ||
        text('.poster-name') ||
        text('[data-testid="poster-name"]') ||
        text('.client-name') ||
        text('.user-name') ||
        null;

      // ── Tech stack: keywords / tags ──────────────────────────────────────────
      const tagEls = document.querySelectorAll(
        '.task-tag, .tag, .skill-tag, [data-testid="tag"]'
      );
      const tech_stack = Array.from(tagEls)
        .map((el) => el.innerText.trim())
        .filter(Boolean);

      return { description, budget_raw, deadline_raw, client_name, tech_stack };
    });

    return detail;
  } catch (err) {
    // Non-fatal: return empty, caller keeps listing-level data
    return {};
  }
}

/**
 * Scrapes the listing page and returns raw card data.
 *
 * @param {import('playwright').Page} page
 * @param {number} pageNum  1-based page number
 * @returns {Promise<Array<{title: string, url: string, budget_raw: string|null, deadline_raw: string|null, client_name: string|null, tech_stack: string[]}>>}
 */
async function scrapeListingPage(page, pageNum) {
  // Build URL: assume ?page=N query parameter for pagination
  const url = pageNum === 1 ? LISTING_URL : `${LISTING_URL}?page=${pageNum}`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const cards = await page.evaluate((baseUrl) => {
    /**
     * Resolve a href to an absolute URL.
     * @param {string} href
     * @returns {string}
     */
    function abs(href) {
      if (!href) return '';
      if (href.startsWith('http')) return href;
      return baseUrl + (href.startsWith('/') ? '' : '/') + href;
    }

    const text = (sel, root = document) => {
      const el = root.querySelector(sel);
      return el ? el.innerText.trim() : null;
    };

    // ── Find task cards ───────────────────────────────────────────────────────
    // Try multiple possible container selectors used by chutask
    const cardSelectors = [
      '.task-card',
      '.task-item',
      '[data-testid="task-card"]',
      'li.task',
      '.job-card',
      '.listing-card',
      'article.task',
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
      // Title
      const titleEl =
        card.querySelector('.task-title a') ||
        card.querySelector('h2 a') ||
        card.querySelector('h3 a') ||
        card.querySelector('a.title') ||
        card.querySelector('.title a') ||
        card.querySelector('a[href*="/task"]') ||
        card.querySelector('a');

      const title = titleEl ? titleEl.innerText.trim() : null;
      const href = titleEl ? titleEl.getAttribute('href') : null;
      const taskUrl = abs(href);

      // Budget (listing-level, often a short range like "NT$1,000~5,000")
      const budget_raw =
        text('.task-budget', card) ||
        text('.budget', card) ||
        text('.price', card) ||
        text('[data-testid="budget"]', card) ||
        null;

      // Deadline
      const deadline_raw =
        text('.task-deadline', card) ||
        text('.deadline', card) ||
        text('.due-date', card) ||
        text('[data-testid="deadline"]', card) ||
        null;

      // Client name shown on card (sometimes not shown)
      const client_name =
        text('.poster-name', card) ||
        text('.client-name', card) ||
        text('.user-name', card) ||
        text('[data-testid="poster-name"]', card) ||
        null;

      // Tags
      const tagEls = card.querySelectorAll(
        '.task-tag, .tag, .skill-tag, [data-testid="tag"]'
      );
      const tech_stack = Array.from(tagEls)
        .map((el) => el.innerText.trim())
        .filter(Boolean);

      return { title, url: taskUrl, budget_raw, deadline_raw, client_name, tech_stack };
    });
  }, BASE_URL);

  return cards.filter((c) => c.title && c.url);
}

/**
 * Main scrape function — entry point consumed by the scraper service.
 *
 * @param {import('playwright').Browser} browser   Playwright browser instance
 * @param {number} limit                            Max leads to return
 * @param {{ delay_min_ms: number, delay_max_ms: number }} opts
 * @returns {Promise<LeadRecord[]>}
 *
 * @typedef {Object} LeadRecord
 * @property {string}      external_id
 * @property {string}      source        Always 'chutask'
 * @property {string}      url
 * @property {string}      title
 * @property {string|null} description
 * @property {string|null} budget_raw
 * @property {string|null} deadline_raw
 * @property {string|null} client_name
 * @property {string[]}    tech_stack
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
    const maxPages = 10; // Safety cap — avoid infinite loops

    while (results.length < limit && pageNum <= maxPages) {
      // ── Scrape listing page ────────────────────────────────────────────────
      let cards;
      try {
        cards = await scrapeListingPage(page, pageNum);
      } catch (err) {
        console.error(`[chutask] Failed to scrape listing page ${pageNum}: ${err.message}`);
        break;
      }

      if (cards.length === 0) {
        // No more results — end of pagination
        break;
      }

      // ── For each card, optionally fetch detail page ────────────────────────
      for (const card of cards) {
        if (results.length >= limit) break;

        const external_id = deriveExternalId(card.url, card.title);

        // Start with listing-level data as baseline
        const lead = {
          external_id,
          source: 'chutask',
          url: card.url,
          title: card.title,
          description: null,
          budget_raw: card.budget_raw,
          deadline_raw: card.deadline_raw,
          client_name: card.client_name,
          tech_stack: card.tech_stack || [],
        };

        // Fetch detail page to enrich with description & missing fields
        if (card.url) {
          await randomDelay(delay_min_ms, delay_max_ms);
          const detail = await scrapeDetailPage(page, card.url);

          // Merge: detail page values win for description; listing wins for budget/deadline if detail empty
          lead.description = detail.description || null;
          lead.budget_raw = detail.budget_raw || lead.budget_raw;
          lead.deadline_raw = detail.deadline_raw || lead.deadline_raw;
          lead.client_name = detail.client_name || lead.client_name;
          if (detail.tech_stack && detail.tech_stack.length > 0) {
            lead.tech_stack = detail.tech_stack;
          }
        }

        results.push(lead);
      }

      pageNum++;

      // Delay before next listing page (skip delay after the last page we need)
      if (results.length < limit && pageNum <= maxPages) {
        await randomDelay(delay_min_ms, delay_max_ms);
      }
    }
  } catch (err) {
    // Return partial results on unexpected error
    console.error(`[chutask] Unexpected error: ${err.message}`);
  } finally {
    await context.close();
  }

  return results.slice(0, limit);
}

module.exports = { scrape };
