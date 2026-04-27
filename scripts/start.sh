#!/usr/bin/env bash
# Hyvemind — one-command startup script.
# Starts the FastAPI backend (port 8787) + Vite dev server (port 8080) in parallel.
# Requirements: Node.js ≥ 18, Python ≥ 3.10, ffmpeg, git
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$REPO/backend"
VENDOR_FW="$REPO/vendor/faster-whisper"

echo "=== Hyvemind startup ==="
echo "Project root: $REPO"

# ── 1. Check required tools ──────────────────────────────────────────────────
for tool in node npm python3 ffmpeg git; do
  if ! command -v "$tool" &>/dev/null; then
    echo "ERROR: '$tool' not found. Please install it first."
    exit 1
  fi
done

# ── 2. .env sanity check ─────────────────────────────────────────────────────
if [[ ! -f "$REPO/.env" ]]; then
  echo "ERROR: .env file not found at $REPO/.env"
  echo "Copy .env.example to .env and fill in your credentials."
  exit 1
fi

# ── 3. Frontend dependencies ─────────────────────────────────────────────────
if [[ ! -d "$REPO/node_modules" ]]; then
  echo "Installing frontend dependencies (npm install)..."
  cd "$REPO" && npm install
fi

# ── 4. Clone faster-whisper if missing ──────────────────────────────────────
if [[ ! -d "$VENDOR_FW" ]]; then
  echo "Cloning faster-whisper..."
  mkdir -p "$REPO/vendor"
  git clone --depth=1 https://github.com/SYSTRAN/faster-whisper.git "$VENDOR_FW"
fi

# ── 5. Python virtual environment & dependencies ─────────────────────────────
VENV="$BACKEND/.venv"
if [[ ! -d "$VENV" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$VENV"
fi

echo "Installing Python dependencies..."
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r "$BACKEND/requirements.txt"

# ── 6. Start services ────────────────────────────────────────────────────────
echo ""
echo "Starting services..."

# Backend
(cd "$BACKEND" && "$VENV/bin/python" main.py &)
BACKEND_PID=$!

# Frontend
(cd "$REPO" && npm run dev &)
FRONTEND_PID=$!

echo ""
echo "✓ Backend  → http://127.0.0.1:8787"
echo "✓ Frontend → http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop both services."

cleanup() {
  echo ""
  echo "Stopping services..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM

wait "$BACKEND_PID" "$FRONTEND_PID"
