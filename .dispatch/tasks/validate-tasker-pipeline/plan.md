# Validate Tasker Pipeline: Scoring + Telegram Notification

- [x] 讀取 services/scraper/scrapers/tasker.js，了解目前爬蟲結構與輸出格式
  - 輸出欄位：external_id, source, url, title, description, budget_raw, deadline_raw, client_name, tech_stack
- [x] 讀取 n8n/workflows/WF-01-lead-scraper.json，確認 Expand Leads → Insert Lead → IF → Score → Redis → Telegram 節點鏈是否完整
  - 鏈路完整；WF-02 負責 Telegram；發現 BUG-01（ollama_model vs model）
- [x] 檢查 services/scraper/server.js 中 /scrape 端點邏輯，確認 tasker 路徑是否被呼叫
  - 動態 require(`./scrapers/${source}`)，source='tasker' 正確載入 tasker.js ✅
- [x] 查閱 .env（或 .env.example）確認 TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID、OLLAMA_HOST 是否已設定
  - TELEGRAM_BOT_TOKEN ✅、TELEGRAM_CHAT_ID ✅、OLLAMA_BASE_URL=http://host.docker.internal:11434 ✅
- [x] 確認 Ollama 評分節點的 prompt 格式（HTTP Request 節點中的 body）與 llama3.2 相容
  - scorer 直接呼叫 Ollama /api/chat（非 n8n 節點直打 Ollama）；格式正確，與 qwen2.5/llama3.2 相容
- [x] 記錄所有發現的潛在問題，以及完整跑通所需的前提條件
  - BUG-01: ollama_model vs model 欄位名稱不符（UPDATE query）
  - BUG-02: WF-02 active=false，需手動啟用
  - WARN-01: n8n credentials 為 placeholder，需 UI 綁定
  - WARN-02: deadline_raw 未插入 DB
  - WARN-03: Redis LRANGE 批次解析邏輯待確認
  - WARN-04: qwen2.5:7b 須確認已 pull
- [x] 將驗證報告（checklist 是否就緒 + 阻塞點）寫入 .dispatch/tasks/validate-tasker-pipeline/output.md
