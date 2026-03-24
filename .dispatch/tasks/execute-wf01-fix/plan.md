# Execute WF-01 Scoring Pipeline Fix

- [x] 確認 `n8n/workflows/WF-01-lead-scraper.json` 包含 node-wf01-08d 和 node-wf01-08e，且 connections 正確 — 兩節點存在，connections: Insert Lead → 08d → 08e → HTTP Score
- [x] 執行 `db/scripts/sync-wf01-to-db.sh` 將修復後的 workflow 同步至 DB（workflow_entity + workflow_history） — jq 不存在故改用 Python 生成 SQL；DB=agency_os, user=agency_user；兩表均 INSERT 0 1 成功
- [x] 執行 `docker compose restart n8n` 重啟 n8n — agency-n8n 已 Restarted/Started
- [x] 查詢 DB 確認 `workflow_entity` 已更新（updatedAt 為最新時間） — updatedAt=2026-03-23 16:58:17, active=true
- [x] 查詢 DB 確認 `workflow_history` 有新紀錄 — versionId=5eb11607, createdAt=2026-03-23 16:57:37
- [x] 查詢 `leads` 表確認 scoring 欄位狀態（scored_at / status / risk_score） — 5 筆 leads 均 status=new, risk_score/fit_score/scored_at 為 null（pipeline 尚未跑，等下次 scheduler 觸發後應填入）
- [x] 寫入結果摘要至 `.dispatch/tasks/execute-wf01-fix/output.md` — 完成，含所有 step 輸出與注意事項
