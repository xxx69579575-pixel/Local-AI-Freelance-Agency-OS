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
  const { source } = req.body;
  const limit       = parseInt(req.body.limit,         10) || 20;
  const delay_min_ms = parseInt(req.body.delay_min_ms, 10) || 2000;
  const delay_max_ms = parseInt(req.body.delay_max_ms, 10) || 5000;

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
    const leads = await scraperModule.scrape(browser, limit, { delay_min_ms, delay_max_ms });
    return res.json({ success: true, source, count: leads.length, leads });
  } catch (err) {
    console.error(`[scraper] Error running ${source}:`, err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await Promise.race([
      browser.close(),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]).catch(() => {});
  }
});

// POST /scrape-all
// Body: { limitPerSource?, delay_min_ms?, delay_max_ms?, sources? }
// Runs all available scrapers (or the subset named in `sources`),
// merges results and deduplicates by URL.
app.post('/scrape-all', async (req, res) => {
  const { sources } = req.body || {};
  const limitPerSource = parseInt((req.body || {}).limitPerSource, 10) || 20;
  const delay_min_ms   = parseInt((req.body || {}).delay_min_ms,   10) || 2000;
  const delay_max_ms   = parseInt((req.body || {}).delay_max_ms,   10) || 5000;

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
    if (browser) await Promise.race([
      browser.close(),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]).catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`[scraper] Service listening on port ${PORT}`);
  console.log(`[scraper] Available sources: ${listScrapers().join(', ')}`);
});
