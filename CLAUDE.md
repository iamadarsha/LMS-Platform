# CLAUDE.md — Hyvemind Agent Runbook

> **For agentic AI (Claude Code, Cursor, etc.):** Read this entire file, then follow the steps in order.  
> The project folder is already present on this Mac with a valid `.env` file. Your only job is to install dependencies and start the platform.

---

## What Is Hyvemind

A full-stack AI knowledge platform. Users upload videos; the system transcribes them (faster-whisper + Gemini 2.5 Flash fallback), extracts structured knowledge (chapters, steps, tags), and publishes a searchable library — all in ~90 seconds per video.

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite — port **8080** |
| Backend | Python FastAPI + uvicorn — port **8787** |
| Auth | Clerk |
| Public feed | Supabase (Postgres + RLS) |
| Job state | Neon Postgres |
| Video storage | Cloudflare R2 |
| Status cache | Upstash Redis |
| Transcription | faster-whisper (`small`, beam_size=5) → Gemini 2.5 Flash fallback |

---

## Prerequisites Check

Run these in order. If any tool is missing, install it first (instructions below).

```bash
# Check all required tools
node --version          # need 18+
python3 --version       # need 3.10+
ffmpeg -version         # need any modern version
```

### Install missing tools (macOS)

```bash
# Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js
brew install node

# Python 3
brew install python3

# ffmpeg
brew install ffmpeg
```

---

## One-Command Bootstrap (Recommended)

```bash
bash setup.sh
```

This single command:
1. Validates all prerequisites (installs missing ones via Homebrew)
2. Validates the `.env` file (fails fast if any placeholder values remain)
3. Installs all npm packages (`npm install`)
4. Creates a Python virtual environment and installs Python dependencies
5. Starts the FastAPI backend on **http://localhost:8787**
6. Starts the Vite frontend on **http://localhost:8080**
7. Opens the browser automatically (macOS)

> If you only want to **start** services (dependencies already installed): `bash setup.sh --run`  
> If you only want to **install** dependencies without starting: `bash setup.sh --setup`

---

## Manual Step-by-Step (if setup.sh fails)

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Set up Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Start the backend

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --host 0.0.0.0 --port 8787 --reload
```

Leave this terminal running. Open a new terminal for the next step.

### 4. Start the frontend

```bash
npm run dev
```

### 5. Open the app

Navigate to **http://localhost:8080**

---

## Verify Everything Is Working

### Backend health check

```bash
curl -s http://localhost:8787/health | python3 -m json.tool
```

Expected response (all services should show `"ok"` or a version string):

```json
{
  "status": "ok",
  "whisper": "small",
  "gemini": "ok",
  "db": "ok",
  "redis": "ok",
  "r2": "ok"
}
```

### Frontend health check

Open http://localhost:8080 — you should see the Hyvemind dark-theme landing/dashboard.

---

## Environment Variables

The `.env` file is at the project root and should already be filled in. It must contain:

| Variable | Service |
|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk (auth) |
| `CLERK_SECRET_KEY` | Clerk (backend JWT verify) |
| `CLERK_ISSUER` | Clerk (JWKS URL base) |
| `CLERK_JWKS_URL` | Clerk (JWKS endpoint) |
| `VITE_SUPABASE_URL` | Supabase (public feed) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase (anon key) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase |
| `GEMINI_API_KEY` | Gemini 2.5 Flash (AI analysis + transcription fallback) |
| `DATABASE_URL` | Neon Postgres (pipeline job state) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis (status caching) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis |
| `R2_ACCOUNT_ID` | Cloudflare R2 (video storage) |
| `R2_BUCKET` | Cloudflare R2 |
| `R2_ENDPOINT` | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 (S3-compatible) |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 (S3-compatible) |

If any variable shows a placeholder like `YOUR_KEY_HERE`, the app will not start correctly. All real values must be present.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `uvicorn: command not found` | Python venv not activated | Run `source .venv/bin/activate` |
| Backend starts but `/health` returns `"whisper": "loading"` | Whisper model downloading on first run (~250 MB) | Wait 60–120s, retry health check |
| Frontend shows blank white screen | Clerk key missing or wrong | Check `VITE_CLERK_PUBLISHABLE_KEY` in `.env` |
| Video upload gets stuck at 72% | R2 credentials wrong | Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` |
| `DB connect failed` in backend logs | Neon idle SSL timeout | Normal on first request after idle — the backend retries automatically |
| Port 8787 already in use | Old backend process running | `lsof -ti:8787 | xargs kill` then restart |
| Port 8080 already in use | Old Vite process running | `lsof -ti:8080 | xargs kill` then restart |

---

## Project Structure

```
.
├── backend/
│   ├── main.py          ← FastAPI app, all API routes
│   ├── pipeline.py      ← Whisper transcription + Gemini analysis pipeline
│   ├── db.py            ← Neon Postgres connection pool + queries
│   ├── r2.py            ← Cloudflare R2 upload/presign helpers
│   ├── redis_client.py  ← Upstash Redis status caching
│   └── requirements.txt
├── src/
│   ├── pages/           ← React pages (Index, ContentDetail, Studio, etc.)
│   ├── components/      ← Shared UI components
│   ├── data/            ← Store logic (Supabase, contributions, favourites)
│   └── integrations/    ← Supabase client + generated types
├── vendor/
│   └── faster-whisper/  ← Vendored Whisper library
├── setup.sh             ← One-command bootstrap
├── .env                 ← Environment variables (already filled in)
└── CLAUDE.md            ← This file
```

---

## Key Architecture Notes for Agents

- **Video flow**: Upload → backend stores on R2 → Whisper transcribes → Gemini analyses → row written to Neon (`contributions` table) → on publish, row also written to Supabase (`contributions` table with `status='published'`) → Supabase RLS makes it visible to all users
- **Video playback URL**: Stored as `r2:<jobId>` in Supabase. Frontend resolves to a signed URL via `GET /api/contributions/<jobId>/video` (no auth required for published content)
- **Transcript sync**: Backend returns `transcript_segments` (array of `{start, end, text}`). The `TranscriptPanel` component auto-scrolls and highlights the active segment in sync with playback
- **Auth**: Clerk provides JWTs. Backend verifies via JWKS. Supabase uses a separate anonymous session for public read access (RLS-gated)
- **Whisper model**: `small` by default. Override with `WHISPER_MODEL=medium` in `.env` for higher quality (3–4× slower)

---

*Last updated: 2026-04-27*
