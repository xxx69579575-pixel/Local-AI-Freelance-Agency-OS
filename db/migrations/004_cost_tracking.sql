-- 004_cost_tracking.sql
-- Cost tracking for Ollama token usage and API spend

CREATE TABLE IF NOT EXISTS cost_logs (
  id                 SERIAL PRIMARY KEY,
  service            VARCHAR(64)      NOT NULL,
  model              VARCHAR(64)      NOT NULL,
  prompt_tokens      INT              NOT NULL DEFAULT 0,
  completion_tokens  INT              NOT NULL DEFAULT 0,
  cost_usd           NUMERIC(10,6)    NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_logs_created_at ON cost_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_cost_logs_service    ON cost_logs (service);
