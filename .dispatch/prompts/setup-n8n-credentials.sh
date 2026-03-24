#!/bin/bash
env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions \
"You have a plan file at .dispatch/tasks/setup-n8n-credentials/plan.md containing a checklist.
Work through it top to bottom. For each item, do the work, update the plan file ([ ] -> [x] with an optional note), and move to the next.
If you hit an unresolvable error, mark the item [!] with a description and stop.
When all items are checked, write a completion marker: touch .dispatch/tasks/setup-n8n-credentials/ipc/.done

Context:
- Working directory: C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS
- Goal: Produce a clear n8n UI guide so the user can manually create Postgres and Redis credentials and rebind them to workflow nodes.
- Reference files: n8n/workflows/WF-01-lead-scraper.json, n8n/workflows/WF-02-telegram-notifier.json, docker-compose.yml, .env
- Guide must include: which n8n menu to use, exact field values (taken from docker-compose.yml), which nodes need rebinding.
- Read-only analysis, do not modify any source files.
- Write the guide to .dispatch/tasks/setup-n8n-credentials/output.md" 2>&1
