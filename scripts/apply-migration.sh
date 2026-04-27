#!/usr/bin/env bash
# Apply Supabase migration for transcript columns.
# Usage:  bash scripts/apply-migration.sh <DB_PASSWORD>
# Get your DB password from: https://supabase.com/dashboard/project/ljxqshalllhgojyvfhaw/settings/database
set -euo pipefail

DB_PASS="${1:-${SUPABASE_DB_PASSWORD:-}}"
if [[ -z "$DB_PASS" ]]; then
  echo "Usage: bash scripts/apply-migration.sh <DB_PASSWORD>"
  echo "       Or: export SUPABASE_DB_PASSWORD=<password> && bash scripts/apply-migration.sh"
  exit 1
fi

PROJECT_REF="ljxqshalllhgojyvfhaw"
DB_URL="postgresql://postgres:${DB_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Applying Supabase migration..."
SUPABASE_DB_PASSWORD="$DB_PASS" supabase db push \
  --db-url "$DB_URL" \
  --project-id "$PROJECT_REF" \
  2>&1

echo "Done. Migration applied successfully."
