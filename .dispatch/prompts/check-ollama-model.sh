#!/bin/bash
env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions \
"You have a plan file at .dispatch/tasks/check-ollama-model/plan.md containing a checklist.
Work through it top to bottom. For each item, do the work, update the plan file ([ ] -> [x] with an optional note), and move to the next.
If you hit an unresolvable error, mark the item [!] with a description and stop.
When all items are checked, write a completion marker: touch .dispatch/tasks/check-ollama-model/ipc/.done

Context:
- Working directory: C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS
- Goal: Read .env to find OLLAMA_MODEL value. Then call http://localhost:11434/api/tags to list installed models. Check if OLLAMA_MODEL is installed. Write result to .dispatch/tasks/check-ollama-model/output.md (installed yes/no, and the pull command if needed). Read-only - do not run ollama pull." 2>&1
