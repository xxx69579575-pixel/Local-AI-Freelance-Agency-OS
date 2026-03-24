#!/usr/bin/env bash
# sync-wf01-to-db.sh
# Upsert WF-01 JSON into n8n's workflow_entity and insert a workflow_history record.
# Must be run AFTER editing n8n/workflows/WF-01-lead-scraper.json.
# Requires: psql, jq, WF_JSON env var (default: repo root relative path)
#
# Usage:
#   DB_HOST=localhost DB_PORT=5432 DB_USER=n8n DB_PASS=n8n DB_NAME=n8n bash db/scripts/sync-wf01-to-db.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WF_JSON="${WF_JSON:-${REPO_ROOT}/n8n/workflows/WF-01-lead-scraper.json}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-n8n}"
DB_PASS="${DB_PASS:-n8n}"
DB_NAME="${DB_NAME:-n8n}"

WORKFLOW_ID="wf-01-lead-scraper"
WORKFLOW_NAME="WF-01 Lead Scraper"

if [[ ! -f "${WF_JSON}" ]]; then
  echo "ERROR: workflow JSON not found at ${WF_JSON}" >&2
  exit 1
fi

WF_NODES=$(jq -c '.nodes' "${WF_JSON}")
WF_CONNECTIONS=$(jq -c '.connections' "${WF_JSON}")
WF_SETTINGS=$(jq -c '.settings' "${WF_JSON}")
WF_ACTIVE=$(jq -r '.active' "${WF_JSON}")

export PGPASSWORD="${DB_PASS}"

PSQL="psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1"

echo "==> Upserting workflow_entity (id=${WORKFLOW_ID}) ..."
$PSQL <<SQL
INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, "staticData", "pinData", "versionId", "updatedAt", "createdAt")
VALUES (
  '${WORKFLOW_ID}',
  '${WORKFLOW_NAME}',
  ${WF_ACTIVE},
  '${WF_NODES}'::jsonb,
  '${WF_CONNECTIONS}'::jsonb,
  '${WF_SETTINGS}'::jsonb,
  '{}',
  '{}',
  gen_random_uuid(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      active      = EXCLUDED.active,
      nodes       = EXCLUDED.nodes,
      connections = EXCLUDED.connections,
      settings    = EXCLUDED.settings,
      "versionId" = gen_random_uuid(),
      "updatedAt" = NOW();
SQL
echo "    workflow_entity upserted."

echo "==> Inserting workflow_history record ..."
$PSQL <<SQL
INSERT INTO workflow_history ("workflowId", nodes, connections, "createdAt", "updatedAt")
VALUES (
  '${WORKFLOW_ID}',
  '${WF_NODES}'::jsonb,
  '${WF_CONNECTIONS}'::jsonb,
  NOW(),
  NOW()
);
SQL
echo "    workflow_history record inserted."

echo ""
echo "Done. WF-01 synced to DB. Restart n8n for changes to take effect:"
echo "  docker compose restart n8n"
