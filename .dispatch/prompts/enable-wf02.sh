#!/bin/bash
env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions \
"You have a plan file at .dispatch/tasks/enable-wf02/plan.md containing a checklist.
Work through it top to bottom. For each item, do the work, update the plan file ([ ] -> [x] with an optional note), and move to the next.
If you hit an unresolvable error, mark the item [!] with a description and stop.
When all items are checked, write a completion marker: touch .dispatch/tasks/enable-wf02/ipc/.done

Context:
- Working directory: C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS
- Goal: In n8n/workflows/WF-02-telegram-notifier.json, find the top-level 'active' field and change it from false to true. Save the file." 2>&1
