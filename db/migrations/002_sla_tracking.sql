-- =============================================================================
-- Migration 002 — SLA tracking & version management
-- Run: psql -U <user> -d <db> -f db/migrations/002_sla_tracking.sql
-- =============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS due_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_hours  INTEGER      NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS version    VARCHAR(20)  NOT NULL DEFAULT '1.0.0';

-- Index for fast SLA deadline queries
CREATE INDEX IF NOT EXISTS idx_projects_due_date ON projects(due_date)
  WHERE due_date IS NOT NULL;
