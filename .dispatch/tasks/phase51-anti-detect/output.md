# Phase 5.1 — 防爬蟲偵測強化 完成摘要

## 變更檔案

| 檔案 | 變更內容 |
|------|----------|
| `services/scraper/user-agents.js` | **新增** — 22 個真實 UA 字串（Chrome/Edge/Safari/Firefox，跨 Windows/macOS/Linux/iOS），`getRandomUA()` 隨機取一 |
| `services/scraper/server.js` | `chromium.launch()` 加入 `args: ['--disable-blink-features=AutomationControlled']`；預設 delay 改為 2000~5000 ms |
| `services/scraper/scrapers/pro360.js` | 移除硬編碼 UA，改用 `getRandomUA()`；`newContext()` 加入隨機 viewport；page 建立後 `evaluate()` 移除 `navigator.webdriver`；預設 delay 改為 2000~5000 ms |
| `services/scraper/scrapers/chutask.js` | 同 pro360.js — UA 輪換、隨機 viewport、`navigator.webdriver` 清除、delay 2000~5000 ms |

## 實作細節

### User-Agent 輪換
- 22 個 UA 涵蓋：Chrome 120–123（Win/Mac/Linux/ARM）、Edge 122–123（Win/Mac）、Safari 17（macOS/iOS）、Firefox 123–124（Win/Mac/Linux）
- 每次 `browser.newContext()` 呼叫前執行 `getRandomUA()`，每個 session 使用不同 UA

### 請求節奏（2–5 秒 jitter）
- `server.js` 預設 `delay_min_ms=2000, delay_max_ms=5000`（原為 1000–3000）
- `pro360.js` / `chutask.js` 內建預設值同步更新
- 呼叫端可透過 POST /scrape body 覆蓋此範圍

### Stealth 設定（純手工，無外部套件）
1. `chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] })` — 關閉 Chromium 自動化旗標
2. `page.evaluate(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }))` — 在每個新頁面移除 `navigator.webdriver` 屬性
3. `viewport` 從 5 種常見桌面解析度隨機選取（1280×800 ~ 1920×1080）

## 未引入外部套件
所有實作均為原生 Playwright API + 標準 JS，沒有 `playwright-extra`、`puppeteer-extra-plugin-stealth` 或其他第三方 stealth 函式庫。
