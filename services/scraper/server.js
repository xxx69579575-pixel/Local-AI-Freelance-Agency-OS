require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// GET /health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'scraper', ts: new Date().toISOString() });
});

// POST /scrape
// Body: { source, limit?, delay_min_ms?, delay_max_ms? }
app.post('/scrape', async (req, res) => {
  const { source, limit = 20, delay_min_ms = 1000, delay_max_ms = 3000 } = req.body;

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
    browser = await chromium.launch({ headless: true });
    const results = await scraperModule.scrape(browser, limit, { delay_min_ms, delay_max_ms });
    return res.json({ source, count: results.length, results });
  } catch (err) {
    console.error(`[scraper] Error running ${source}:`, err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`[scraper] Service listening on port ${PORT}`);
});
