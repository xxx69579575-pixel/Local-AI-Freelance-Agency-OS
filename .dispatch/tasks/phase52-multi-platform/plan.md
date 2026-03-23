# Phase 5.2 — 多平台擴充

- [x] 讀取現有 services/scraper/ PRO360 爬蟲實作，了解 scraper 架構 — 每個 scraper export async scrape(browser, limit, opts)，回傳 { external_id, source, url, title, description, budget_raw, deadline_raw, client_name, tech_stack }[]
- [x] 新增 scrapers/104-outsource.js：抓取 104 外包網公開案件列表
- [x] 新增 scrapers/freelancer-tw.js：抓取 Freelancer.com 台灣區公開案件（無需登入頁面）
- [x] 更新 scraper index.js：動態載入所有 scrapers/ 下的模組並合併結果 — 新增 scrapers/index.js (scrapeAll + listScrapers) 並在 server.js 增加 /scrape-all endpoint
- [x] 更新 n8n/workflows/ 規格文件，記錄新平台的抓取頻率建議 — docs/n8n-workflow-spec.md 新增頻率表 + /scrape-all 說明；n8n/workflows/README.md 更新 WF-01 描述
- [x] 寫入摘要至 .dispatch/tasks/phase52-multi-platform/output.md
