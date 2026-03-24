#!/bin/bash
cd "C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS"
env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions "$(cat C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS/.dispatch/scripts/phase23-24-bootstrapper-prompt.txt)" 2>&1
