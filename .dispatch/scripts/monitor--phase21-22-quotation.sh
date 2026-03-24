#!/bin/bash
IPC_DIR="C:/Users/xx/Desktop/Local-AI-Freelance-Agency-OS/.dispatch/tasks/phase21-22-quotation/ipc"
TIMEOUT=1800
START=$(date +%s)
shopt -s nullglob
while true; do
  [ -f "$IPC_DIR/.done" ] && exit 0
  for q in "$IPC_DIR"/*.question; do
    seq=$(basename "$q" .question)
    [ ! -f "$IPC_DIR/${seq}.answer" ] && exit 0
  done
  ELAPSED=$(( $(date +%s) - START ))
  [ "$ELAPSED" -ge "$TIMEOUT" ] && exit 1
  sleep 3
done
