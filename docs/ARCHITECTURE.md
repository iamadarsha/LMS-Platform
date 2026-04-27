# Hyvemind — System Architecture

## Overview

Hyvemind is a dark-themed knowledge library platform where users upload how-to videos that are automatically transcribed and AI-analysed. The platform has two storage layers: **Neon Postgres** for per-user pipeline job state, and **Supabase** for the public content feed.

---

## Service Topology

```
Browser (Vite + React)
        │
        ├── REST API calls ─────────────────────────────────────────────►  FastAPI (port 8787)
        │    (Authorization: Bearer <Clerk JWT>)                              │
        │                                                                     ├── Neon Postgres (job state)
        │                                                                     ├── Cloudflare R2 (video/audio)
        │                                                                     ├── Upstash Redis (cache)
        │                                                                     └── Google Gemini 2.5 Flash (AI)
        │
        ├── Supabase JS client ────────────────────────────────────────►  Supabase (public feed)
        │    (anon key — RLS enforced)                                        └── contributions, profiles, watch_progress
        │
        └── Clerk JS SDK ───────────────────────────────────────────────►  Clerk (auth)
```

---

## Frontend (React + Vite)

| Layer | Tech |
|-------|------|
| Framework | React 18, TypeScript strict, Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | `@clerk/clerk-react` — `useUser()`, `useAuth()`, `<UserButton>` |
| Public data | Supabase JS client (`@supabase/supabase-js`) |
| State | Zustand stores: `watchProgressStore`, `favouritesStore` |

### Key Pages
- `/` — `Index.tsx` — home feed with Continue Watching / Trending / Explore grids
- `/content/:slug` — `ContentDetail.tsx` — video player + live transcript panel
- `/explore` — `Explore.tsx` — searchable, filterable library
- `/studio/contribute` — `Contribute.tsx` — 5-step contribution wizard
- `/studio` — `StudioDashboard.tsx` — creator hub with upload history
- `/settings` — `Settings.tsx` — Clerk profile + security settings
- `/signin` — `SignIn.tsx` — embedded Clerk sign-in/sign-up

### Data Flow (Frontend)
```
useContributions()
  → supabase.from('contributions').select(*)   (public feed)
  → merge with contentLibrary (static seed data)
  → { items: ContentEntry[], isLoading: boolean }

contributionPipeline.ts
  → uploadContributionVideoToPipeline()   POST /api/contributions/upload
  → pollContributionStatus()              GET  /api/contributions/:id/status  (3s poll)
  → fetchContributionResult()             GET  /api/contributions/:id/result
  → publishContribution()                 POST /api/contributions/:id/publish
    → addContribution()                   writes to Supabase public feed
```

---

## Backend (FastAPI + Python)

Entry point: `backend/main.py`, runs on `http://127.0.0.1:8787`.

### Auth
Every `/api/contributions/*` route requires `Authorization: Bearer <Clerk JWT>`. The `auth.py` module verifies the JWT against Clerk's JWKS endpoint and extracts `sub` (Clerk user id).

### Pipeline (`pipeline.py`)
```
run_job(job_id)
  1. ffmpeg  → extract 16kHz mono WAV from video
  2. Whisper → transcribe (faster-whisper, small model)
       └── FALLBACK: Gemini Files API if Whisper fails
  3. R2      → upload original + audio (non-fatal if misconfigured)
  4. Gemini  → structured analysis (title, summary, tags, chapters, steps)
```

### Database Modules
- `db.py` — Neon Postgres via psycopg3. Tables: `users`, `contributions`
- `r2.py` — Cloudflare R2. Dual-path: S3 SDK (access key) or REST API (cfat_ token)
- `cache.py` — Upstash Redis REST. Status caching (2s in-flight / 60s terminal), rate limiting
- `auth.py` — Clerk JWKS JWT verification

---

## Data Stores

### Neon Postgres (pipeline state)
```sql
users (id uuid, clerk_id text, name text, image_url text, ...)
contributions (
  id text PK, user_clerk_id text,
  status text, stage_label text, progress int,
  title text, original_file_name text,
  original_path text, audio_path text,
  original_r2_key text, audio_r2_key text,
  transcript text, transcript_segments jsonb,
  detected_language text, analysis jsonb,
  is_published bool, published_at timestamptz,
  created_at/updated_at timestamptz
)
```

### Supabase (public feed)
```sql
contributions (slug, title, type, author, thumbnail, summary,
               transcript, transcript_segments, detected_language,
               duration, tags, steps, chapters, ...)
watch_progress (contribution_id, position_seconds, duration_seconds, completed, ...)
profiles (clerk_id, name, avatar_url, skills, ...)
```

---

## Environment Variables

See [`.env.example`](../.env.example) for the full list with descriptions.

Critical variables:
- `GEMINI_API_KEY` — required for AI analysis (and Whisper fallback transcription)
- `DATABASE_URL` — Neon Postgres connection string
- `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_JWKS_URL` — Clerk auth
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` — public feed

---

## Local Development

```bash
# Start everything (backend + frontend)
bash scripts/start.sh

# Or separately:
cd backend && .venv/bin/python main.py          # port 8787
npm run dev                                      # port 8080
```

The Vite dev server proxies `/api` → `http://127.0.0.1:8787` (see `vite.config.ts`).
