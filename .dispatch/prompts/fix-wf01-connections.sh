#!/bin/bash
env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions \
"You have a plan file at .dispatch/tasks/fix-wf01-connections/plan.md containing a checklist.
Work through it top to bottom. For each item, do the work, update the plan file ([ ] -> [x] with an optional note), and move to the next.
If you hit an unresolvable error, mark the item [!] with a description and stop.
When all items are checked, write a completion marker: touch .dispatch/tasks/fix-wf01-connections/ipc/.done

Context:
- Working directory: C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS
- File to modify: n8n/workflows/WF-01-lead-scraper.json
- Problem: In the current connections, the chain is: Insert Lead -> Log Insert Success -> HTTP Score Lead.
  Log Insert Success has no RETURNING clause so it outputs empty {}, breaking the \$json context before scoring.
- Fix: Rewire so that Insert Lead connects DIRECTLY to HTTP Score Lead (main path).
  Log Insert Success becomes a side branch off Insert Lead (e.g. second output or parallel branch).
- In n8n JSON, connections are stored under the 'connections' key as: { 'NodeName': { main: [[{node, type, index}], ...] } }
- Read the current connections carefully, then restructure so Insert Lead's main[0][0] points to HTTP Score Lead,
  and Log Insert Success is either removed from main path or connected as a separate branch from Insert Lead.
- Save the file. Validate JSON is well-formed." 2>&1
