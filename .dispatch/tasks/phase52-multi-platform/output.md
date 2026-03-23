# Phase 5.2 — 多平台擴充 完成摘要

**完成時間**：2026-03-22

---

## 新增檔案

| 檔案 | 說明 |
|------|------|
| `services/scraper/scrapers/104-outsource.js` | 104 外包網公開案件爬蟲（無登入） |
| `services/scraper/scrapers/freelancer-tw.js` | Freelancer.com 公開 project 列表爬蟲（無登入） |
| `services/scraper/scrapers/index.js` | 統一索引：動態發現所有 scraper、並行執行、URL 去重合併 |

## 修改檔案

| 檔案 | 變更說明 |
|------|---------|
| `services/scraper/server.js` | 新增 `POST /scrape-all` endpoint；`GET /health` 回傳 `sources` 清單；啟動時印出可用 scraper 列表 |
| `docs/n8n-workflow-spec.md` | WF-01 sources 清單加入 `104-outsource`、`freelancer-tw`；新增多平台抓取頻率建議表 |
| `n8n/workflows/README.md` | WF-01 用途說明更新 |

---

## 架構說明

### Scraper 統一介面（不變）
每個 scraper 均 export：
```js
async function scrape(browser, limit, opts) → LeadRecord[]
```

LeadRecord 欄位：
```
{ external_id, source, url, title, description,
  budget_raw, deadline_raw, client_name, tech_stack }
```

### scrapers/index.js — scrapeAll()
- `fs.readdirSync()` 動態發現 `scrapers/*.js`（排除 `index.js`）
- `Promise.allSettled()` 並行執行所有 scraper
- 以 `url` 為 key 去重，回傳合併陣列

### POST /scrape-all
```json
{ "limitPerSource": 20, "delay_min_ms": 2000, "delay_max_ms": 5000, "sources": ["pro360"] }
```
`sources` 選填，不傳則跑全部平台。

---

## 抓取頻率建議

| 平台 | 建議頻率 | 理由 |
|------|----------|------|
| pro360 | 每小時 | 台灣主力，案件密集 |
| chutask | 每小時 | 更新頻率高 |
| 104-outsource | 每 2 小時 | 對自動化較敏感，降頻防封 |
| freelancer-tw | 每 3 小時 | 國際平台，更新慢且易觸發 rate-limit |

---

## 注意事項

- 兩個新 scraper 均**不做登入**，僅抓公開列表頁，符合 PRO360 條款要求。
- 104 和 Freelancer 的前端為 SPA，scraper 使用 `waitForSelector` 等待 DOM 就緒，若選器失效（前端改版）只需更新 selector 清單。
- `scrapers/index.js` 採用「只需丟 JS 檔進 scrapers/ 目錄」的零配置設計，未來新增平台無需修改 index 或 server。
