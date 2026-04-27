#!/usr/bin/env bash
# Apply all Supabase migrations to a target project via the Management API.
# Uses a Personal Access Token (sbp_...) — no DB password required.
#
# Usage:  bash scripts/apply-migrations.sh
# Env vars:
#   SUPABASE_PAT        — Personal Access Token (sbp_...)
#   SUPABASE_PROJECT_REF — project ref (e.g. qaxvghxmkqblpicxcbqm)
set -euo pipefail

PAT="${SUPABASE_PAT:?SUPABASE_PAT must be set}"
REF="${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF must be set}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

while IFS= read -r -d '' sql_file; do
  name="$(basename "$sql_file")"
  echo "→ Applying $name"
  body=$(jq -Rs '{query: .}' < "$sql_file")
  resp=$(curl -s -w "\n%{http_code}" -X POST \
    "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $PAT" \
    -H "Content-Type: application/json" \
    -d "$body")
  code=$(echo "$resp" | tail -n1)
  output=$(echo "$resp" | sed '$d')
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "  ✓ ok"
  else
    echo "  ✗ HTTP $code"
    echo "  $output" | head -c 800
    echo ""
    # Don't abort on non-fatal errors (e.g. "already exists")
    if echo "$output" | grep -qE 'already exists|does not exist|duplicate'; then
      echo "  (treated as non-fatal)"
      continue
    fi
    exit 1
  fi
done < <(find "$DIR" -name '*.sql' -print0 | sort -z)

echo ""
echo "All migrations applied to project $REF."
