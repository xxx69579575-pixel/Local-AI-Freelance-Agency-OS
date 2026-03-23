# Fix WF-01: Move Log Insert to Side Branch

- [x] 讀取 WF-01 JSON，找出 node-wf01-08（Postgres - Insert Lead）、node-wf01-08b（Postgres - Log Insert Success）、node-wf01-09（HTTP - Score Lead）的 connections 結構
- [x] 修改 connections：Insert Lead 的 main[0] 改為同時連接 HTTP Score Lead 和 Log Insert Success（parallel fan-out），Log Insert Success 不再擋在主線上
- [x] 確認 Log Insert Success 不再擋在 Score Lead 之前（$json 上下文不被截斷）
- [x] 確認修改後 JSON 格式正確（valid JSON）
