# Clear Duplicate Leads for Pipeline Re-test

- [x] 查閱 docker-compose.yml 確認 PostgreSQL 連線設定（host/port/db/user）<!-- container: agency-postgres, db: agency_os, user: agency_user -->
- [x] 連接 DB，執行 SELECT 確認 leads 表目前筆數與來源分佈（source 欄位）<!-- pro360: 20, tasker: 3, freelancer-tw: 3; total=26 -->
- [x] 識別安全刪除範圍：保留最新 2-3 筆作為參照，刪除其餘重複的 pro360 leads（約 17-18 筆），讓 pipeline 有新資料可跑<!-- 保留 id 384,385,386；刪除 367-383 共 17 筆 -->
- [x] 執行 DELETE，確認刪除後 leads 表筆數正確<!-- DELETE 17; remaining pro360=3; total leads=9 -->
- [x] 將操作 SQL 與刪除前後筆數差異寫入 .dispatch/tasks/clear-duplicate-leads/output.md
