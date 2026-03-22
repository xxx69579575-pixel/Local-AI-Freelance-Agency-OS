'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3003;

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const ALL_STATUSES = [
  'new',
  'scoring',
  'pending_decision',
  'rejected',
  'pending_quote',
  'quoted',
  'negotiating',
  'negotiation_abandoned',
  'won',
  'in_development',
  'pending_review',
  'in_revision',
  'pending_final',
  'closed',
];

// GET /api/kanban — all statuses with counts and lead lists
app.get('/api/kanban', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        title,
        source,
        status,
        risk_score,
        fit_score,
        expected_profit_score AS profit_score,
        scraped_at
      FROM leads
      ORDER BY scraped_at DESC
    `);

    const result = {};
    for (const status of ALL_STATUSES) {
      result[status] = { count: 0, leads: [] };
    }

    for (const row of rows) {
      const bucket = result[row.status];
      if (bucket) {
        bucket.leads.push(row);
        bucket.count++;
      }
    }

    res.json(result);
  } catch (err) {
    console.error('GET /api/kanban error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kanban/:status — leads for a single status
app.get('/api/kanban/:status', async (req, res) => {
  const { status } = req.params;
  if (!ALL_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Unknown status: ${status}` });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
        id,
        title,
        source,
        status,
        risk_score,
        fit_score,
        expected_profit_score AS profit_score,
        scraped_at
      FROM leads
      WHERE status = $1
      ORDER BY scraped_at DESC`,
      [status]
    );

    res.json({ status, count: rows.length, leads: rows });
  } catch (err) {
    console.error(`GET /api/kanban/${status} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET / — serve kanban.html
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kanban.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'dashboard', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[dashboard] listening on port ${PORT}`);
});
