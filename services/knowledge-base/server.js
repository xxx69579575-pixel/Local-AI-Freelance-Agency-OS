'use strict';

require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3010;

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Ensure knowledge_base table exists (idempotent bootstrap)
// ---------------------------------------------------------------------------
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER,
      category    VARCHAR(100),
      tags        TEXT[]       DEFAULT '{}',
      budget_min  INTEGER,
      budget_max  INTEGER,
      outcome     VARCHAR(10)  NOT NULL DEFAULT 'pending'
                  CHECK (outcome IN ('won', 'lost', 'pending')),
      key_factors TEXT,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_kb_tags       ON knowledge_base USING GIN(tags)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_kb_outcome    ON knowledge_base(outcome)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_kb_project_id ON knowledge_base(project_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_kb_created_at ON knowledge_base(created_at DESC)
  `);
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'knowledge-base', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /learn
// Body: { project_id?, category?, tags?, budget_min?, budget_max?, outcome?, key_factors? }
// 結案後記錄學習資料
// ---------------------------------------------------------------------------
app.post('/learn', async (req, res) => {
  const {
    project_id,
    category,
    tags,
    budget_min,
    budget_max,
    outcome,
    key_factors,
  } = req.body;

  const validOutcomes = ['won', 'lost', 'pending'];
  const resolvedOutcome = validOutcomes.includes(outcome) ? outcome : 'pending';

  const tagsArr = Array.isArray(tags) ? tags : [];

  try {
    const { rows } = await pool.query(
      `INSERT INTO knowledge_base
         (project_id, category, tags, budget_min, budget_max, outcome, key_factors)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        project_id ? Number(project_id) : null,
        category   ? String(category)   : null,
        tagsArr,
        budget_min != null ? Number(budget_min) : null,
        budget_max != null ? Number(budget_max) : null,
        resolvedOutcome,
        key_factors ? String(key_factors) : null,
      ]
    );

    console.log(`[knowledge-base] POST /learn — id=${rows[0].id} outcome=${resolvedOutcome} tags=${tagsArr.join(',')}`);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[knowledge-base] POST /learn error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /suggest
// Query: ?tags=tag1,tag2,tag3   (comma-separated)
// 查詢相似歷史案件，用 tags 陣列重疊（&&）篩選，回傳最多 3 筆
// ---------------------------------------------------------------------------
app.get('/suggest', async (req, res) => {
  const rawTags = req.query.tags || '';
  const queryTags = rawTags
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (queryTags.length === 0) {
    return res.json({ suggestions: [] });
  }

  try {
    // Use && (overlap) to find cases sharing at least one tag
    // Order by number of matching tags descending for most-similar first
    const { rows } = await pool.query(
      `SELECT
         id,
         project_id,
         category,
         tags,
         budget_min,
         budget_max,
         outcome,
         key_factors,
         created_at,
         (
           SELECT COUNT(*)
           FROM unnest(tags) t
           WHERE t = ANY($1::TEXT[])
         ) AS match_count
       FROM knowledge_base
       WHERE tags && $1::TEXT[]
       ORDER BY match_count DESC, created_at DESC
       LIMIT 3`,
      [queryTags]
    );

    console.log(`[knowledge-base] GET /suggest tags=[${queryTags.join(',')}] → ${rows.length} results`);
    return res.json({ suggestions: rows });
  } catch (err) {
    console.error('[knowledge-base] GET /suggest error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /knowledge
// Query: ?tags=tag1,tag2  &outcome=won|lost|pending  &page=1  &limit=20
// 分頁瀏覽知識庫，供 dashboard 使用
// ---------------------------------------------------------------------------
app.get('/knowledge', async (req, res) => {
  const { outcome, tags: rawTags } = req.query;
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  const validOutcomes = ['won', 'lost', 'pending'];
  if (outcome && validOutcomes.includes(outcome)) {
    params.push(outcome);
    conditions.push(`outcome = $${params.length}`);
  }

  if (rawTags) {
    const filterTags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
    if (filterTags.length > 0) {
      params.push(filterTags);
      conditions.push(`tags && $${params.length}::TEXT[]`);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [rowsResult, statsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, project_id, category, tags, budget_min, budget_max, outcome, key_factors, created_at
         FROM knowledge_base
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`
        SELECT
          outcome,
          COUNT(*) AS cnt
        FROM knowledge_base
        GROUP BY outcome
      `),
      pool.query(
        `SELECT COUNT(*) FROM knowledge_base ${where}`,
        params
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    const outcomeStats = { won: 0, lost: 0, pending: 0 };
    for (const row of statsResult.rows) {
      if (outcomeStats[row.outcome] !== undefined) {
        outcomeStats[row.outcome] = parseInt(row.cnt, 10);
      }
    }

    return res.json({
      records:       rowsResult.rows,
      total,
      page,
      limit,
      total_pages:   Math.ceil(total / limit),
      outcome_stats: outcomeStats,
    });
  } catch (err) {
    console.error('[knowledge-base] GET /knowledge error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
ensureTable()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[knowledge-base] listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[knowledge-base] failed to ensure table:', err.message);
    process.exit(1);
  });
