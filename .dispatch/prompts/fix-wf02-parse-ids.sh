#!/bin/bash
env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions \
"You have a plan file at .dispatch/tasks/fix-wf02-parse-ids/plan.md containing a checklist.
Work through it top to bottom. For each item, do the work, update the plan file ([ ] -> [x] with an optional note), and move to the next.
If you hit an unresolvable error, mark the item [!] with a description and stop.
When all items are checked, write a completion marker: touch .dispatch/tasks/fix-wf02-parse-ids/ipc/.done

Context:
- Working directory: C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS
- File to modify: n8n/workflows/WF-02-telegram-notifier.json
- Find the Code node named 'Code - Parse Lead IDs' (node-wf02-04) and locate its jsCode field.
- Current logic uses split(',') which is fragile. n8n Redis lrange returns each element as a separate execution item with { value: '<single_id>' }.
- Replace the jsCode content with:
  const leadId = parseInt(String(\$json.value || ''), 10);
  if (!leadId || isNaN(leadId)) return [];
  return [{ json: { lead_id: leadId } }];
- Save the file. Validate JSON is well-formed." 2>&1
