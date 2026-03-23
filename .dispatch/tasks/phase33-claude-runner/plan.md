# Phase 3.3 — Claude Code 執行整合

- [x] 在 services/dev-dispatcher/ 新增 claude-runner.js
- [x] 實作 runClaudeTask(projectPath)：讀取 .dispatch/task.md，spawn `claude --print` child process
- [x] 擷取 stdout/stderr，寫入 .dispatch/output.md
- [x] 執行完成後呼叫 POST /complete（project_id + summary）
- [x] 從 server.js 的 /dispatch 端點引用 claude-runner（非同步執行，setImmediate）
- [x] 寫入摘要至 .dispatch/tasks/phase33-claude-runner/output.md
