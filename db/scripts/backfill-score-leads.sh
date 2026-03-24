#!/bin/bash
# Backfill scoring for existing unscored leads
# Usage: bash db/scripts/backfill-score-leads.sh

SCORER_URL="http://localhost:3002/score"
DB_CONTAINER="agency-postgres"
DB_USER="agency_user"
DB_NAME="agency_os"

echo "=== Backfill scoring for unscored leads ==="
LEADS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
  "SELECT id, title, description, budget_raw FROM leads WHERE risk_score IS NULL AND status = 'new' AND notified_at IS NULL ORDER BY created_at LIMIT 50;")

COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM leads WHERE risk_score IS NULL AND status = 'new';" | tr -d ' ')

echo "Found $COUNT unscored leads"

while IFS='|' read -r id title description budget_raw; do
  id=$(echo "$id" | tr -d ' ')
  [ -z "$id" ] && continue

  echo "Scoring lead $id: $title"
  RESPONSE=$(curl -s -X POST "$SCORER_URL" \
    -H "Content-Type: application/json" \
    -d "{\"lead_id\": $id, \"title\": \"$(echo $title | tr -d '\"')\", \"description\": \"$(echo $description | tr -d '\"')\", \"budget_raw\": \"$(echo $budget_raw | tr -d '\"')\", \"tech_stack\": []}" \
    --max-time 60)

  if echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('risk_score','ERROR'))" 2>/dev/null | grep -qv "ERROR"; then
    RISK=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('risk_score',0))")
    FIT=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('fit_score',0))")
    PROFIT=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('expected_profit_score',0))")
    BUDGET=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('budget_estimate',''))")
    ACTION=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('recommended_action','hold'))")
    REASON=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('reason_summary','').replace(\"'\",\"''\"))" )
    MODEL=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ollama_model','unknown'))")

    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
      "UPDATE leads SET status='pending_decision', risk_score=$RISK, fit_score=$FIT, expected_profit_score=$PROFIT, budget_estimate='$BUDGET', recommended_action='$ACTION', reason_summary='$REASON', ollama_model='$MODEL', scored_at=NOW(), status_updated_at=NOW() WHERE id=$id;" > /dev/null
    echo "  -> scored: risk=$RISK fit=$FIT profit=$PROFIT action=$ACTION"
  else
    echo "  -> FAILED: $RESPONSE"
  fi
  sleep 2
done <<< "$LEADS"

echo "=== Done ==="
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
  "SELECT COUNT(*) as still_unscored FROM leads WHERE risk_score IS NULL AND status = 'new';"
