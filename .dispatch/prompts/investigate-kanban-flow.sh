#!/bin/bash
env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions \
"You have a plan file at .dispatch/tasks/investigate-kanban-flow/plan.md containing a checklist.
Work through it top to bottom. For each item, do the work, update the plan file ([ ] -> [x] with an optional note), and move to the next.
If you hit an unresolvable error, mark the item [!] with a description and stop.
When all items are checked, write a completion marker: touch .dispatch/tasks/investigate-kanban-flow/ipc/.done

Context:
- Working directory: C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS
- Problem: Pipeline ran 20 leads, Kanban shows no 'pending_decision' status, Telegram received no notifications.
- Background: WF-01 ran successfully but likely took NoOp path (duplicates). WF-02 was active=false (being fixed separately).
- Investigate: Beyond WF-02 being disabled, are there other reasons leads did not reach pending_decision state?
- Reference files: n8n/workflows/WF-01-lead-scraper.json, n8n/workflows/WF-02-telegram-notifier.json
- DB: docker exec agency-postgres psql -U agency_user -d agency_os -c 'SELECT id, status, fit_score, risk_score, recommended_action FROM leads ORDER BY id DESC LIMIT 10'
- Redis: docker exec agency-redis redis-cli LLEN queue:notify
- Check: leads table status column, scoring columns, Redis queue length
- Write full diagnosis report to .dispatch/tasks/investigate-kanban-flow/output.md" 2>&1
