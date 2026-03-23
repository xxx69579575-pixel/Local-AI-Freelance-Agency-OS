# Phase 5.1 — 防爬蟲偵測強化

- [x] 讀取 services/scraper/ 現有 Playwright 爬蟲實作 — server.js + pro360.js + chutask.js 全部讀完
- [x] 新增 user-agents.js：22 個真實 UA 字串（Chrome/Edge/Safari/Firefox 跨平台），getRandomUA() 隨機輪換
- [x] 在 scraper 加入請求節奏控制：server.js 預設改為 2000~5000ms；pro360/chutask 預設值同步更新
- [x] 新增 stealth 設定：server.js 加 --disable-blink-features=AutomationControlled；page.evaluate 移除 navigator.webdriver；newContext viewport 隨機化
- [x] 寫入摘要至.dispatch/tasks/phase51-anti-detect/output.md
