# intake — 計劃文件

**Context**: {{context}}
**Model**: {{model}}
**Started**: {{started_at}}

- [ ] 解析輸入：提取 project_name（AI 自動提取，或透過 IPC 詢問）
- [ ] 呼叫 AI 分析需求，生成 IntakeOutput JSON（最多重試 2 次）
- [ ] 驗證 JSON 格式，確認所有必填欄位存在
- [ ] 生成 YAML frontmatter + Markdown 並寫入 docs/intake/{{slug}}.md
- [ ] 確認輸出文件可被 write-spec 讀取（frontmatter 解析測試）
- [ ] 寫入 output.md 摘要
