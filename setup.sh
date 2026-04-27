#!/usr/bin/env bash
# Hyvemind — one-command bootstrap + run.
#
# Works on a fresh macOS install. Installs Homebrew (if missing), Node.js,
# Python, and ffmpeg, then sets up dependencies and launches both services.
#
# Usage:
#   bash setup.sh           # bootstrap + run
#   bash setup.sh --setup   # bootstrap only (don't start)
#   bash setup.sh --run     # skip bootstrap, just start (faster on subsequent runs)
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$REPO/backend"
VENDOR_FW="$REPO/vendor/faster-whisper"
VENV="$BACKEND/.venv"

MODE="${1:-all}"   # all | --setup | --run

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[1;32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[1;33m%s\033[0m\n" "$*"; }
red() { printf "\033[1;31m%s\033[0m\n" "$*"; }

echo ""
bold "═══════════════════════════════════════════"
bold "  Hyvemind — one-command setup + run"
bold "═══════════════════════════════════════════"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# BOOTSTRAP — install OS-level prerequisites
# ──────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" != "--run" ]]; then

  bold "[1/6] Checking Homebrew…"
  if ! command -v brew &>/dev/null; then
    yellow "  Homebrew not found — installing (you may be asked for your password)…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Apple Silicon brew lives in /opt/homebrew
    if [[ -d /opt/homebrew/bin ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
  fi
  green "  ✓ brew $(brew --version | head -1)"

  bold "[2/6] Checking Node.js…"
  if ! command -v node &>/dev/null; then
    yellow "  Installing Node.js via brew…"
    brew install node
  fi
  green "  ✓ node $(node --version)"

  bold "[3/6] Checking Python 3…"
  if ! command -v python3 &>/dev/null; then
    yellow "  Installing Python 3 via brew…"
    brew install python
  fi
  green "  ✓ $(python3 --version)"

  bold "[4/6] Checking ffmpeg…"
  if ! command -v ffmpeg &>/dev/null; then
    yellow "  Installing ffmpeg via brew (required for audio extraction)…"
    brew install ffmpeg
  fi
  green "  ✓ $(ffmpeg -version 2>/dev/null | head -1 | cut -d ' ' -f1-3)"

  bold "[5/6] Frontend dependencies (npm install)…"
  cd "$REPO"
  if [[ ! -d node_modules ]]; then
    npm install
  else
    green "  ✓ already installed (delete node_modules to reinstall)"
  fi

  bold "[6/6] Backend Python venv + dependencies…"
  if [[ ! -d "$VENV" ]]; then
    python3 -m venv "$VENV"
  fi
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$BACKEND/requirements.txt"
  green "  ✓ Python deps installed"

  # faster-whisper sanity (vendored in repo, but fall back if missing)
  if [[ ! -d "$VENDOR_FW" ]]; then
    yellow "  vendor/faster-whisper missing — cloning from upstream…"
    mkdir -p "$REPO/vendor"
    git clone --depth=1 https://github.com/SYSTRAN/faster-whisper.git "$VENDOR_FW"
  fi

  echo ""
  green "✓ Bootstrap complete."
  echo ""

fi

if [[ "$MODE" == "--setup" ]]; then
  bold "Done. Run 'bash setup.sh --run' to start the platform."
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
# .env check
# ──────────────────────────────────────────────────────────────────────────────
if [[ ! -f "$REPO/.env" ]]; then
  red "✗ .env file not found at $REPO/.env"
  echo ""
  echo "  Copy .env.example to .env and fill in your credentials:"
  echo "      cp .env.example .env"
  echo "      \$EDITOR .env"
  echo ""
  echo "  See README.md → 'Where to get each credential' for links."
  exit 1
fi

# Quick smoke check that the critical keys aren't placeholders
for key in VITE_CLERK_PUBLISHABLE_KEY GEMINI_API_KEY DATABASE_URL VITE_SUPABASE_URL; do
  val=$(grep -E "^${key}=" "$REPO/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [[ -z "$val" || "$val" == *"..."* || "$val" == *"<"* ]]; then
    red "✗ .env: $key looks like a placeholder. Fill it in before starting."
    exit 1
  fi
done

# ──────────────────────────────────────────────────────────────────────────────
# RUN — start backend + frontend
# ──────────────────────────────────────────────────────────────────────────────
bold "Starting services…"
echo ""

# Start backend in background, keep PID
cd "$BACKEND"
"$VENV/bin/python" main.py > "/tmp/hyvemind-backend.log" 2>&1 &
BACKEND_PID=$!
cd "$REPO"

# Start frontend in background, keep PID
npm run dev > "/tmp/hyvemind-frontend.log" 2>&1 &
FRONTEND_PID=$!

# Wait a moment for services to spin up
sleep 3

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  red "✗ Backend failed to start. Last 20 lines of /tmp/hyvemind-backend.log:"
  tail -20 /tmp/hyvemind-backend.log
  kill "$FRONTEND_PID" 2>/dev/null || true
  exit 1
fi
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  red "✗ Frontend failed to start. Last 20 lines of /tmp/hyvemind-frontend.log:"
  tail -20 /tmp/hyvemind-frontend.log
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 1
fi

echo ""
green "═══════════════════════════════════════════"
green "  ✓ Hyvemind is running"
green "═══════════════════════════════════════════"
echo ""
echo "  Frontend  →  http://localhost:8080"
echo "  Backend   →  http://127.0.0.1:8787"
echo "  Health    →  http://127.0.0.1:8787/api/health"
echo ""
echo "  Logs:"
echo "    tail -f /tmp/hyvemind-backend.log"
echo "    tail -f /tmp/hyvemind-frontend.log"
echo ""
echo "  Press Ctrl+C to stop both services."
echo ""

# Try to open the frontend in the default browser (macOS only)
if command -v open &>/dev/null; then
  (sleep 2 && open "http://localhost:8080") &
fi

cleanup() {
  echo ""
  yellow "Stopping services…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  green "Done."
}
trap cleanup INT TERM EXIT

wait "$BACKEND_PID" "$FRONTEND_PID"
