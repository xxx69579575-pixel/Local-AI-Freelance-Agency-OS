# Investigate: 20 Leads 未進入「待我決策」

- [x] 讀取 WF-01 workflow JSON，找出 IF 節點的判斷條件（是什麼決定一筆 lead 進入「待我決策」狀態？）
  - node-wf01-10 (Postgres - Update Score) 執行後才設 status='pending_decision'，在 HTTP Score Lead 成功後觸發
- [x] 確認 scoring 節點（HTTP Score Lead）的回傳結構與 IF 條件的欄位是否匹配
  - 發現關鍵 Bug：node-wf01-08b (Log Insert Success) 沒有 RETURNING，導致 $json context 遺失，HTTP Score Lead 收到空資料
- [x] 查詢 DB：SELECT id, status, fit_score, risk_score, recommended_action FROM leads ORDER BY id DESC LIMIT 10，確認已入庫的 leads 的 status 和 scoring 欄位是否已填入
  - 確認：leads 854–863 全部 status='new'，fit_score/risk_score/recommended_action 全為 NULL → scoring 從未執行
- [x] 查詢 Redis queue:notify 的長度（llen queue:notify），確認 leads 是否有進入通知佇列
  - LLEN queue:notify = 0 → 確認沒有任何 lead 進入通知佇列
- [x] 讀取 WF-02 JSON，確認 Telegram sendMessage 節點的條件與訊息格式
  - WF-02 active=false（確認停用）；另有 Redis lrange 解析邏輯潛在問題
- [x] 綜合分析：20 筆未進「待我決策」的根本原因（scoring 未執行？IF 條件太嚴？WF-02 停用？Telegram 節點問題？）
  - 根本原因是 WF-01 Pipeline Bug：Log Insert 節點截斷了 $json 上下文，scoring 永遠收不到正確資料
- [x] 將完整診斷報告與修復建議寫入 .dispatch/tasks/investigate-kanban-flow/output.md
