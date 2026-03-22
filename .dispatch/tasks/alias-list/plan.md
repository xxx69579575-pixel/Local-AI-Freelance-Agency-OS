# Build Task Alias List for Local-AI-Freelance-Agency-OS

- [x] Read CLAUDE.md, 任務.txt, and 新專案的啟動流程.md to understand the project purpose and workflow
  — SDD methodology, freelance agency lifecycle: intake → spec → dispatch → code → review → deploy
- [x] Identify all expected task types across the project lifecycle (init, dev, deploy, review, debug, etc.)
  — 6 groups: project init, spec/SDD, development, review & QA, deployment, utility
- [x] Categorize each task type by complexity: low (haiku), medium (sonnet), high (opus)
  — haiku: status/list/git ops/cleanup/build-check; sonnet: implement/fix/deploy/qa; opus: intake/write-spec/code-review/refactor/security
- [x] Draft alias entries in ~/.dispatch/config.yaml YAML format, with a meaningful prompt for each
  — 22 aliases total across 6 groups
- [x] Write the complete alias list to .dispatch/tasks/alias-list/output.md
  — Written to .dispatch/tasks/alias-list/output.md with YAML format and group comments
