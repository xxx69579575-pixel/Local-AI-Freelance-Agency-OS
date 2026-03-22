'use strict';

/**
 * Scraper Index — discovers and runs all platform scrapers,
 * merging results with URL-based deduplication.
 *
 * Usage:
 *   const { scrapeAll } = require('./scrapers/index');
 *   const leads = await scrapeAll(browser, { limitPerSource: 20 });
 *
 * Each scraper module in this directory must export:
 *   module.exports = { scrape: async (browser, limit, opts) => LeadRecord[] }
 *
 * @module scrapers/index
 */

const fs = require('fs');
const path = require('path');

/** File names that are NOT individual scraper modules. */
const EXCLUDED_FILES = new Set(['index.js']);

/**
 * Returns an array of { name, module } for every scraper in this directory.
 * Scrapers are loaded lazily — this only reads the directory listing.
 *
 * @returns {{ name: string, modulePath: string }[]}
 */
function discoverScrapers() {
  const dir = __dirname;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !EXCLUDED_FILES.has(f))
    .map((f) => ({
      name: path.basename(f, '.js'),
      modulePath: path.join(dir, f),
    }));
}

/**
 * Runs all discovered scrapers in parallel and merges results.
 * Deduplication is performed by URL (exact match).
 *
 * @param {import('playwright').Browser} browser   Shared Playwright browser instance
 * @param {object}  [opts]
 * @param {number}  [opts.limitPerSource=20]        Max leads per scraper
 * @param {number}  [opts.delay_min_ms=1000]
 * @param {number}  [opts.delay_max_ms=3000]
 * @param {string[]}[opts.sources]                  If set, only run these named scrapers
 * @returns {Promise<object[]>}  Merged, deduplicated lead array
 */
async function scrapeAll(browser, opts = {}) {
  const {
    limitPerSource = 20,
    delay_min_ms = 1000,
    delay_max_ms = 3000,
    sources,
  } = opts;

  let scrapers = discoverScrapers();

  if (sources && sources.length > 0) {
    const sourceSet = new Set(sources);
    scrapers = scrapers.filter((s) => sourceSet.has(s.name));
  }

  if (scrapers.length === 0) {
    console.warn('[scraper/index] No scrapers found or matched.');
    return [];
  }

  console.log(`[scraper/index] Running ${scrapers.length} scraper(s): ${scrapers.map((s) => s.name).join(', ')}`);

  // Run all scrapers concurrently
  const results = await Promise.allSettled(
    scrapers.map(async ({ name, modulePath }) => {
      try {
        const mod = require(modulePath);
        if (typeof mod.scrape !== 'function') {
          console.warn(`[scraper/index] ${name}: no scrape() export — skipping`);
          return [];
        }
        const leads = await mod.scrape(browser, limitPerSource, { delay_min_ms, delay_max_ms });
        console.log(`[scraper/index] ${name}: returned ${leads.length} leads`);
        return leads;
      } catch (err) {
        console.error(`[scraper/index] ${name}: error — ${err.message}`);
        return [];
      }
    })
  );

  // Flatten and deduplicate by URL
  const seen = new Set();
  const merged = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const lead of result.value) {
      const key = lead.url;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(lead);
    }
  }

  console.log(`[scraper/index] total after dedup: ${merged.length} leads`);
  return merged;
}

/**
 * Returns the names of all available scrapers in this directory.
 * @returns {string[]}
 */
function listScrapers() {
  return discoverScrapers().map((s) => s.name);
}

module.exports = { scrapeAll, listScrapers };
