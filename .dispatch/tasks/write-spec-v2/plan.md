# Phase 5.2 — 補充規格（QA fail + 安全問題修復規格）

- [x] 閱讀 docs/qa/2026-03-22-qa.md，整理所有 [fail] 項目（15 條）— sdd 11 fail, intake 3 fail, dispatch 1 fail
- [x] 閱讀 docs/security/2026-03-22-audit.md，整理所有高/中風險問題（6 條）— SEC-001~006 已整理，3 高風險：憑證曝露、缺少認證、缺少 CORS
- [ ] 撰寫 `docs/specs/sdd-workflow-impl.md`：針對 sdd-workflow 模組（12 條 AC 全 fail）的實作規格
- [ ] 撰寫 `docs/specs/security-hardening.md`：針對 3 個高風險安全問題的修復規格（身份驗證、API Key 管理、CORS）
- [ ] 在每份規格文件頂部加上版本號 v1.0 與撰寫日期
- [ ] 將完成摘要寫入 `.dispatch/tasks/write-spec-v2/output.md`
