# Setup n8n Credentials Guide

- [x] 讀取 WF-01 和 WF-02 的 workflow JSON，列出所有 credential placeholder（Postgres、Redis、HTTP 等）
      — WF-01: 5 Postgres nodes + 1 Redis node; WF-02: 2 Postgres nodes + 3 Redis nodes. All use placeholder IDs "POSTGRES_CREDENTIAL_ID" / "REDIS_CREDENTIAL_ID".
- [x] 確認 docker-compose.yml 中 Postgres/Redis 的實際連線參數（host、port、db、user、password）
      — Postgres: host=postgres, port=5432, db=agency_os, user=agency_user; Redis: host=redis, port=6379. Passwords read from .env.
- [x] 產出 n8n UI 操作步驟指南：如何在 n8n 新增 Postgres credential、Redis credential，以及如何重新綁定到各節點
- [x] 將完整指南寫入 .dispatch/tasks/setup-n8n-credentials/output.md
