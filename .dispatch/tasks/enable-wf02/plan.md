# Enable WF-02 Telegram Notifier

- [x] 讀取 n8n/workflows/WF-02-telegram-notifier.json，確認 "active" 欄位當前值 — 值為 false (line 259)
- [x] 將 "active": false 改為 "active": true 並存檔
- [x] 確認 JSON 格式正確（無語法錯誤）— python json.loads 驗證通過
