# Restore Cron to Hourly Schedule

- [x] 讀取 n8n/workflows/WF-01-lead-scraper.json，找出 Schedule Trigger 節點的 interval/cron 設定 — 發現 `expression: "0 * * * *"`，已為每小時
- [x] 將觸發間隔改為每小時（cronExpression 或 interval 設為 1 hour）— 已是 `0 * * * *`，無需修改
- [x] 確認修改後的 JSON 格式正確（valid JSON），無語法錯誤 — 原檔案格式正確，未觸動
- [x] 將修改結果寫入 .dispatch/tasks/restore-cron-hourly/output.md，說明修改前後的差異 — 已寫入，記錄無需變更
