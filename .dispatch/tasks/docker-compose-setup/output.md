# Docker Compose 骨架建立完成

**完成時間**：2026-03-22

## 建立的檔案

| 檔案 | 說明 |
|------|------|
| `docker-compose.yml` | 6 服務（n8n / ollama / postgres / redis / scraper / scorer）、agency-net bridge 網路、4 named volumes、postgres & redis healthcheck |
| `.env.example` | 所有環境變數，changeme_ 佔位，無真實密碼 |
| `db/init.sql` | PostgreSQL 初始化腳本（leads 資料表佔位，待 db-schema.md 完成後補全）|
| `db/.gitkeep` | 確保 db/ 目錄被 git 追蹤 |
| `projects/.gitkeep` | 確保 projects/ 目錄被 git 追蹤 |

## 修正事項

- `scorer.depends_on` 原規格混用 sequence item（`- ollama`）與 mapping item（`postgres: condition:`），YAML 不合法。已統一改為長格式 mapping：
  - `ollama: condition: service_started`
  - `postgres: condition: service_healthy`

## YAML 驗證

```
python -c "import yaml; yaml.safe_load(open('docker-compose.yml', encoding='utf-8'))" → OK
```

## 下一步

1. `cp .env.example .env` 並填入真實值
2. 建立 `services/scraper/Dockerfile` 與 `services/scorer/Dockerfile`
3. 完善 `db/init.sql`（參考 docs/db-schema.md 規格）
4. `docker-compose up -d`
5. `docker exec -it agency-ollama ollama pull llama3.2`
