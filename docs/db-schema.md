# 資料庫 Schema — Local AI Freelance Agency OS

> **版本**：v1.0
> **日期**：2026-03-22
> **資料庫**：PostgreSQL 15

---

## 1. Kanban 狀態流

```
新抓到 → AI評估中 → 待你決策 → [已放棄]
                          │
                       待報價 → 已送報價 → 商談中 → [放棄洽談]
                                                │
                                             已成交 → 開發中 → 待初審
                                                               │
                                                          待修正 → 待最終確認 → 已結案
```

### 狀態代碼對照表

| 狀態代碼 | 顯示名稱 | 說明 |
|----------|----------|------|
| `new` | 新抓到 | Scraper 剛抓到，尚未評分 |
| `scoring` | AI評估中 | Ollama 評分中 |
| `pending_decision` | 待你決策 | 評分完成，等待人工決策 |
| `rejected` | 已放棄 | 人工決定放棄 |
| `pending_quote` | 待報價 | 決定聯絡，報價草稿準備中 |
| `quoted` | 已送報價 | 報價已（人工）送出 |
| `negotiating` | 商談中 | 客戶回應，正在洽談 |
| `negotiation_abandoned` | 放棄洽談 | 洽談中放棄 |
| `won` | 已成交 | 確認成交 |
| `in_development` | 開發中 | 進入開發 |
| `pending_review` | 待初審 | 等待人工初審 |
| `in_revision` | 待修正 | 客戶有修改需求 |
| `pending_final` | 待最終確認 | 等待客戶最終確認 |
| `closed` | 已結案 | 案件完成 |

---

## 2. 資料表定義

### 2.1 `leads` — 案件資料

```sql
CREATE TABLE leads (
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

    -- 狀態
    status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN (
                        'new', 'scoring', 'pending_decision',
                        'rejected', 'pending_quote', 'quoted',
                        'negotiating', 'negotiation_abandoned',
                        'won', 'in_development', 'pending_review',
                        'in_revision', 'pending_final', 'closed'
                    )),
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 後續關聯
    project_id      INTEGER REFERENCES projects(id),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_scraped_at ON leads(scraped_at DESC);
CREATE UNIQUE INDEX idx_leads_external ON leads(source, external_id) WHERE external_id IS NOT NULL;
```

---

### 2.2 `projects` — 成交專案

```sql
CREATE TABLE projects (
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

    -- 狀態（與 leads 同步）
    status          TEXT NOT NULL DEFAULT 'won'
                    CHECK (status IN (
                        'won', 'in_development', 'pending_review',
                        'in_revision', 'pending_final', 'closed'
                    )),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE UNIQUE INDEX idx_projects_slug ON projects(slug);
```

---

### 2.3 `kanban_status` — 狀態變更日誌

```sql
CREATE TABLE kanban_status (
    id              SERIAL PRIMARY KEY,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('lead', 'project')),
    entity_id       INTEGER NOT NULL,
    from_status     TEXT,
    to_status       TEXT NOT NULL,
    triggered_by    TEXT NOT NULL,                 -- 'system' | 'telegram' | 'webhook' | 'manual'
    note            TEXT,                          -- 備註（人工填寫的原因）
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kanban_entity ON kanban_status(entity_type, entity_id);
CREATE INDEX idx_kanban_created_at ON kanban_status(created_at DESC);
```

---

### 2.4 `agent_logs` — Agent 操作日誌

```sql
CREATE TABLE agent_logs (
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

CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX idx_agent_logs_status ON agent_logs(status);
CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at DESC);
CREATE INDEX idx_agent_logs_entity ON agent_logs(entity_type, entity_id);
```

---

### 2.5 `quotations` — 報價記錄

```sql
CREATE TABLE quotations (
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

CREATE INDEX idx_quotations_lead ON quotations(lead_id);
```

---

### 2.6 `revisions` — 修改單

```sql
CREATE TABLE revisions (
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

CREATE INDEX idx_revisions_project ON revisions(project_id);
CREATE INDEX idx_revisions_status ON revisions(status);
```

---

## 3. 觸發器（Triggers）

### 3.1 自動更新 `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 套用到所有有 updated_at 的表
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
```

### 3.2 自動寫入 Kanban 狀態日誌

```sql
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

CREATE TRIGGER trg_leads_status_log
    AFTER UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION log_lead_status_change();
```

---

## 4. 初始化 SQL

```sql
-- 建立資料庫與使用者
CREATE DATABASE agency_os;
CREATE USER agency_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE agency_os TO agency_user;

-- 連入後執行所有 CREATE TABLE 語句
\c agency_os
-- ... (上方所有建表語句)
```

---

## 5. Redis 結構

| Key Pattern | 型別 | 用途 | TTL |
|-------------|------|------|-----|
| `lead:score:lock:{id}` | String | Ollama 評分鎖，防重複 | 5分鐘 |
| `scraper:last_run:{source}` | String | 記錄上次抓取時間 | 永久 |
| `telegram:session:{chat_id}` | Hash | Telegram 對話狀態 | 24小時 |
| `rate:scraper:{source}` | Counter | 速率限制計數器 | 1分鐘 |
| `queue:scoring` | List | 待評分案件 ID 佇列 | 永久 |
| `queue:notify` | List | 待通知案件 ID 佇列 | 永久 |
