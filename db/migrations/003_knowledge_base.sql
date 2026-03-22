-- =============================================================================
-- Migration 003 — Knowledge Base (CRM 案件學習)
-- Run: psql -U <user> -d <db> -f db/migrations/003_knowledge_base.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_base (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    category    VARCHAR(100),
    tags        TEXT[]                   DEFAULT '{}',
    budget_min  INTEGER,
    budget_max  INTEGER,
    outcome     VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (outcome IN ('won', 'lost', 'pending')),
    key_factors TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN index for fast array overlap queries (tags && ARRAY[...])
CREATE INDEX IF NOT EXISTS idx_kb_tags       ON knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_kb_outcome    ON knowledge_base(outcome);
CREATE INDEX IF NOT EXISTS idx_kb_project_id ON knowledge_base(project_id);
CREATE INDEX IF NOT EXISTS idx_kb_created_at ON knowledge_base(created_at DESC);
