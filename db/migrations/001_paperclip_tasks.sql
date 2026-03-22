-- =============================================================================
-- Migration 001 — Paperclip tasks table
-- Run: psql -U <user> -d <db> -f db/migrations/001_paperclip_tasks.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER REFERENCES projects(id),
    agent_name  TEXT NOT NULL,
    action      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'created'
                CHECK (status IN ('created','dispatched','running','completed','failed','cancelled')),
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id  ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at   ON tasks(created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
