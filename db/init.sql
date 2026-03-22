-- Local AI Freelance Agency OS — PostgreSQL 初始化腳本
-- 此檔案在 postgres 容器第一次啟動時自動執行
-- 詳細 schema 請參考 docs/db-schema.md（待建立）

-- 建立 leads 資料表（佔位，待 db-schema 規格完成後補全）
CREATE TABLE IF NOT EXISTS leads (
  id          SERIAL PRIMARY KEY,
  source      VARCHAR(50)  NOT NULL,
  title       TEXT         NOT NULL,
  url         TEXT         UNIQUE NOT NULL,
  raw_content TEXT,
  score_risk  NUMERIC(3,1),
  score_fit   NUMERIC(3,1),
  score_profit NUMERIC(3,1),
  status      VARCHAR(30)  NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
