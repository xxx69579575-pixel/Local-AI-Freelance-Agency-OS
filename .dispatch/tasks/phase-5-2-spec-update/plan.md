# Phase 5.2 — 規格迭代修訂（SDD 下一輪循環）

- [x] 讀取 docs/progress/2026-03-22-summary.md，整理「待處理問題」章節中的規格缺口清單<!-- note: 已識別警告-02/03/04/05、QA-F4/F5、SEC-002/004 -->
- [x] 讀取 docs/specs/intake-module.md（當前版本 v1.1）<!-- note: 已確認 §4.4 使用 sonnet，§3.4 version 說明不足，AC 缺少 AC-10/11 -->
- [x] 讀取 docs/specs/dispatch-module.md（當前版本 v1.1）<!-- note: 已確認 GET /tasks/:id 副作用、askAndPause 前置條件缺失、無安全規格 -->
- [x] 修訂 intake-module.md：解決警告-02（version 欄位規格：由 write-spec 固定輸出 v1.0，後續由 update-spec 透過 version-manager 遞增，不應在 parser 硬寫）；解決警告-03（§4.4 模型規格統一為 opus，與 CLAUDE.md 一致）；補充 AC：mvp_features 和 risks 最少各需 1 項（已實作，補充 AC 文件）；bump 版本 v1.1 → v1.2，加入 changelog<!-- note: §4.4 model→opus，§3.4 version 說明加入，AC-10/AC-11 加入，v1.2 changelog 已寫入 -->
- [x] 修訂 dispatch-module.md：解決警告-04（GET /api/dispatch/tasks/:id 不應有寫入副作用，timed_out 狀態更新應移至 PATCH 端點或由輪詢機制處理，補充 API 規格）；解決警告-05（askAndPause 應在拋出 WaitingForInputError 前確保 context 已儲存，補充前置條件 AC）；補充 SEC-002（X-API-Key Header 驗證規格，短期可選，中期必要）；補充 SEC-004（速率限制規格：max 60 req/min per IP，超限回 429）；bump 版本 v1.1 → v1.2，加入 changelog<!-- note: §4.2 讀取語義已補充，§4.4 askAndPause 前置條件已補充，§4.6 SEC-002 已新增，§4.7 SEC-004 已新增，v1.2 changelog 已寫入 -->
- [x] 確認所有修訂問題已在 docs/specs/review/agency-os-review.md 對應 RV 標記為 RESOLVED，或新增 NOTE 說明<!-- note: RV-001~017 全部標記為 RESOLVED（v1.1）；Phase 5.2 新增問題表格（警告-02/03/04/05、QA-F4/F5、SEC-002/004）均標記為 RESOLVED（v1.2）-->
- [x] 寫入完成摘要至 .dispatch/tasks/phase-5-2-spec-update/output.md<!-- note: 完整摘要已寫入，含修訂成果表、版本狀態、未解決問題清單 -->
