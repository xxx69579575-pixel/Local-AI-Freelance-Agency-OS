-- =============================================================================
-- Local AI Freelance Agency OS — PostgreSQL 15 Schema
-- Version: v1.0  |  Date: 2026-03-22
--
-- 使用說明：
--   psql -U postgres -c "CREATE DATABASE agency_os;"
--   psql -U postgres -d agency_os -f db/init.sql
--
-- 建立順序（處理 leads ↔ projects 循環 FK）：
--   1. leads（暫不加 project_id FK）
--   2. projects（FK → leads）
--   3. ALTER TABLE leads ADD CONSTRAINT FK → projects
--   4. kanban_status、agent_logs、quotations、revisions
--   5. Indexes
--   6. Trigger functions → Triggers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. leads — 案件資料
--    project_id FK 暫缺，待 projects 建立後補上
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id              SERIAL PRIMARY KEY,
    external_id     TEXT,                          -- 平台原始 ID
    source          TEXT NOT NULL,                 -- 'pro360' | 'chutask' | ...
    url             TEXT,                          -- 案件原始連結
    title           TEXT NOT NULL,
    description     TEXT,                          -- 原始案件描述
    budget_raw      TEXT,                          -- 原始預算文字
    budget_estimate TEXT,                          -- AI 解析後預算
    deadline_raw    TEXT,                          -- 原始截止日文字
    deadline        DATE,                          -- 解析後日期
    tech_stack      TEXT[],                        -- 技術棧陣列
    client_name     TEXT,                          -- 發案方（若公開）
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- AI 評分
    risk_score              SMALLINT CHECK (risk_score BETWEEN 1 AND 10),
    fit_score               SMALLINT CHECK (fit_score BETWEEN 1 AND 10),
    expected_profit_score   SMALLINT CHECK (expected_profit_score BETWEEN 1 AND 10),
    recommended_action      TEXT,
    reason_summary          TEXT,
    scored_at               TIMESTAMPTZ,
    ollama_model            TEXT,                  -- 使用的模型版本

    -- 狀態（14 個 Kanban 狀態）
    status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN (
                        'new', 'scoring', 'pending_decision',
                        'rejected', 'pending_quote', 'quoted',
                        'negotiating', 'negotiation_abandoned',
                        'won', 'in_development', 'pending_review',
                        'in_revision', 'pending_final', 'closed'
                    )),
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- project_id 欄位先建立，FK constraint 在 projects 建立後再加
    project_id      INTEGER,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. projects — 成交專案
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id              SERIAL PRIMARY KEY,
    lead_id         INTEGER NOT NULL REFERENCES leads(id),
    slug            TEXT NOT NULL,                 -- URL-friendly 名稱
    title           TEXT NOT NULL,
    client_name     TEXT,
    client_contact  TEXT,                          -- 聯絡方式

    -- 財務
    agreed_price    NUMERIC(10, 2),               -- 成交金額
    currency        TEXT DEFAULT 'TWD',

    -- 時程
    started_at      DATE,
    due_date        DATE,
    delivered_at    DATE,
    closed_at       DATE,

    -- 路徑
    workspace_path  TEXT,                          -- /projects/{id}-{slug}/

    -- 狀態（與 leads 成案後同步）
    status          TEXT NOT NULL DEFAULT 'won'
                    CHECK (status IN (
                        'won', 'in_development', 'pending_review',
                        'in_revision', 'pending_final', 'closed'
                    )),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. 補上 leads.project_id → projects 的 FK constraint（解決循環相依）
-- ---------------------------------------------------------------------------
ALTER TABLE leads
    ADD CONSTRAINT fk_leads_project
    FOREIGN KEY (project_id) REFERENCES projects(id);

-- ---------------------------------------------------------------------------
-- 4. kanban_status — 狀態變更日誌
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanban_status (
    id              SERIAL PRIMARY KEY,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('lead', 'project')),
    entity_id       INTEGER NOT NULL,
    from_status     TEXT,
    to_status       TEXT NOT NULL,
    triggered_by    TEXT NOT NULL,                 -- 'system' | 'telegram' | 'webhook' | 'manual'
    note            TEXT,                          -- 備註（人工填寫的原因）
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. agent_logs — Agent 操作日誌
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_logs (
    id              SERIAL PRIMARY KEY,
    agent_name      TEXT NOT NULL,                 -- 'scraper' | 'ollama' | 'telegram' | 'n8n' | 'bootstrapper'
    action          TEXT NOT NULL,                 -- 操作名稱
    entity_type     TEXT,                          -- 關聯實體類型
    entity_id       INTEGER,                       -- 關聯實體 ID
    status          TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed', 'skipped')),
    duration_ms     INTEGER,                       -- 執行時間（毫秒）
    input_summary   TEXT,                          -- 輸入摘要
    output_summary  TEXT,                          -- 輸出摘要
    error_message   TEXT,                          -- 錯誤訊息
    metadata        JSONB,                         -- 附加資料
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6. quotations — 報價記錄
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotations (
    id              SERIAL PRIMARY KEY,
    lead_id         INTEGER NOT NULL REFERENCES leads(id),
    draft_content   TEXT,                          -- AI 草稿內容
    final_content   TEXT,                          -- 人工修改後最終版
    generated_at    TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    approved_by     TEXT DEFAULT 'human',
    sent_at         TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. revisions — 修改單
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revisions (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id),
    revision_number INTEGER NOT NULL,              -- 001, 002, ...
    file_path       TEXT,                          -- revision-001.md 路徑
    client_feedback TEXT,                          -- 原始客戶回饋
    parsed_tasks    JSONB,                         -- Ollama 解析後的任務清單
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'done', 'approved')),
    assigned_to     TEXT,                          -- 'claude_code' | 'codex' | 'human'
    completed_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (project_id, revision_number)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source     ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_scraped_at ON leads(scraped_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external ON leads(source, external_id)
    WHERE external_id IS NOT NULL;

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

-- kanban_status
CREATE INDEX IF NOT EXISTS idx_kanban_entity     ON kanban_status(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_kanban_created_at ON kanban_status(created_at DESC);

-- agent_logs
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent      ON agent_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status     ON agent_logs(status);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_entity     ON agent_logs(entity_type, entity_id);

-- quotations
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations(lead_id);

-- revisions
CREATE INDEX IF NOT EXISTS idx_revisions_project ON revisions(project_id);
CREATE INDEX IF NOT EXISTS idx_revisions_status  ON revisions(status);

-- =============================================================================
-- TRIGGER FUNCTIONS（必須在 CREATE TRIGGER 之前定義）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- T1. 自動更新 updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- T2. 自動寫入 Kanban 狀態日誌（僅 leads）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO kanban_status (entity_type, entity_id, from_status, to_status, triggered_by)
        VALUES ('lead', NEW.id, OLD.status, NEW.status, 'system');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- updated_at triggers
CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_quotations_updated_at
    BEFORE UPDATE ON quotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_revisions_updated_at
    BEFORE UPDATE ON revisions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- lead status change → kanban_status log
CREATE TRIGGER trg_leads_status_log
    AFTER UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION log_lead_status_change();

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
