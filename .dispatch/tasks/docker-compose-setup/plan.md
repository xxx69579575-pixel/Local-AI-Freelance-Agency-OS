# 建立 Docker Compose 骨架

- [x] 讀取 docs/docker-compose-spec.md 確認規格
- [x] 建立 docker-compose.yml（6 服務：n8n/ollama/postgres/redis/scraper/scorer，agency-net 網路，volumes，healthcheck）
- [x] 建立 .env.example（所有環境變數，changeme_ 佔位，無真實密碼）
- [x] 建立 db/init.sql 佔位目錄結構（db/.gitkeep，確認目錄存在）
- [x] 建立 projects/.gitkeep（確保目錄被 git 追蹤）
- [x] 確認 docker-compose.yml YAML 語法正確，寫入完成摘要到 .dispatch/tasks/docker-compose-setup/output.md（修正 scorer.depends_on 混合語法錯誤）
