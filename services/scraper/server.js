require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');
const { scrapeAll, listScrapers } = require('./scrapers/index');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// GET /health
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'scraper',
    ts: new Date().toISOString(),
    sources: listScrapers(),
  });
});

// POST /scrape
// Body: { source, limit?, delay_min_ms?, delay_max_ms? }
app.post('/scrape', async (req, res) => {
  const { source, limit = 20, delay_min_ms = 2000, delay_max_ms = 5000 } = req.body;

  if (!source) {
    return res.status(400).json({ error: '`source` is required' });
  }

  let scraperModule;
  try {
    scraperModule = require(`./scrapers/${source}`);
  } catch (err) {
    return res.status(404).json({ error: `No scraper found for source: ${source}` });
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const results = await scraperModule.scrape(browser, limit, { delay_min_ms, delay_max_ms });
    return res.json({ source, count: results.length, results });
  } catch (err) {
    console.error(`[scraper] Error running ${source}:`, err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// POST /scrape-all
// Body: { limitPerSource?, delay_min_ms?, delay_max_ms?, sources? }
// Runs all available scrapers (or the subset named in `sources`),
// merges results and deduplicates by URL.
app.post('/scrape-all', async (req, res) => {
  const {
    limitPerSource = 20,
    delay_min_ms = 2000,
    delay_max_ms = 5000,
    sources,
  } = req.body || {};

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const results = await scrapeAll(browser, { limitPerSource, delay_min_ms, delay_max_ms, sources });
    return res.json({ count: results.length, results });
  } catch (err) {
    console.error('[scraper] Error in /scrape-all:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`[scraper] Service listening on port ${PORT}`);
  console.log(`[scraper] Available sources: ${listScrapers().join(', ')}`);
});
