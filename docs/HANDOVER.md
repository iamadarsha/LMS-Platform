# Hyvemind — AI Handover File

This document is written for an LLM (or new developer) picking up the Hyvemind codebase cold.

---

## What this project is

Hyvemind is a **dark-themed knowledge library platform**. Users watch how-to videos. Authenticated creators upload videos via a 5-step studio wizard. Uploads are automatically transcribed (faster-whisper, with Gemini fallback) and AI-analysed (Gemini 2.5 Flash). The result is a structured content card — title, summary, tags, chapters, steps — that appears in the public feed.

---

## Dual-store architecture (critical to understand)

There are **two separate databases** with different roles. Confusing them is the #1 source of bugs:

| Store | Role | Access |
|-------|------|--------|
| **Neon Postgres** (`db.py`) | Per-user pipeline job state. Private. | Backend only, psycopg3 |
| **Supabase** (`contributionsStore.ts`) | Public content feed, watch progress, profiles | Frontend JS client (anon key + RLS) |

A contribution starts as a Neon row. After the user clicks **Publish**, `addContribution()` writes a *separate* row to the Supabase `contributions` table. The Neon row is never exposed to the frontend directly — it's only read by the backend.

---

## Auth (dual-layer)

- **Clerk** handles sign-in (Google/GitHub OAuth or email/password). The frontend uses `@clerk/clerk-react`.
- Every backend request to `/api/contributions/*` must carry `Authorization: Bearer <Clerk JWT>`.
- The backend verifies the JWT via `auth.py` → `ClerkUser(user_id, email, raw)`.
- Supabase has its own anon session (separate from Clerk). `contributionsStore.ts` uses the Supabase JS client directly with the anon key. RLS policies are in place on the Supabase side.

---

## Key files to read first

```
backend/
  main.py          ← FastAPI routes + lifespan startup
  pipeline.py      ← run_job(): ffmpeg → Whisper → R2 → Gemini
  db.py            ← Neon schema + CRUD
  auth.py          ← Clerk JWT verification
  r2.py            ← Cloudflare R2 (dual-path: S3 SDK or REST)
  cache.py         ← Upstash Redis REST

src/
  data/
    contributionsStore.ts   ← useContributions() → { items, isLoading }
    contributionPipeline.ts ← frontend API calls to backend
    content.ts              ← ContentEntry type + static seed data
    watchProgressStore.ts   ← Supabase watch_progress CRUD
  components/
    VideoPlayer.tsx         ← forwardRef, VTT track, CC button
    TranscriptPanel.tsx     ← live-synced scrollable transcript
  pages/
    ContentDetail.tsx       ← video + transcript + metadata
    Contribute.tsx          ← 5-step contribution wizard
    studio/StudioDashboard  ← creator hub
```

---

## Patterns and conventions

### `useContributions()` returns `{ items, isLoading }`
Always destructure both. Never render "empty" state while `isLoading` is true — use a skeleton. `ContentDetail.tsx` and `Index.tsx` both implement this pattern.

### Transcript data flow
```
pipeline.py:_transcribe() → transcript_segments (jsonb in Neon)
→ fetchContributionResult() → transcriptSegments[]
→ addContribution() → Supabase contributions.transcript_segments
→ useContributions() → ContentEntry.transcriptSegments
→ ContentDetail → TranscriptPanel + VideoPlayer <track>
```

### Whisper → Gemini fallback
`pipeline.py:_transcribe()` tries Whisper first. On any exception, it calls `_transcribe_with_gemini_audio()` which uploads the WAV to Gemini Files API. If both fail, the job enters `error` state. The fallback is invisible to users — the transcript quality may differ slightly.

### VTT generation
`src/lib/vtt.ts:segmentsToVtt()` converts `TranscriptSegment[]` → WEBVTT string. `vttBlobUrl()` wraps it in a `Blob URL`. The `VideoPlayer` attaches it as a `<track>` element. The blob URL is revoked on unmount.

### Scroll-reveal animations
Sections use the CSS class `.reveal`. When `IntersectionObserver` fires, it adds `.in-view`. Stagger animations use `.reveal.in-view .reveal-stack > *` (NOT `.reveal-stack > *` alone — that caused pre-scroll flash).

---

## Known technical debt

1. **Dual auth**: Clerk session + Supabase anon session coexist. They're independent. This works but is architecturally messy. A proper fix would use Clerk JWTs as Supabase JWTs (Clerk's Supabase integration), but that requires RLS policy changes.

2. **Static seed data**: `src/data/content.ts` `contentLibrary` has hardcoded sample contributions. These should be removed once real contributions are plentiful.

3. **No server-side rendering**: The app is a pure SPA. Slug-based routing (`/content/:slug`) resolves client-side. Slugs are derived from titles via `slugify()` — duplicate titles would collide.

4. **Whisper model download on first run**: The faster-whisper model (`small` by default) is downloaded from HuggingFace on first use. This can take 1-3 minutes on a fresh deployment. Set `WHISPER_MODEL=tiny` in `.env` to speed up first boot at the cost of transcription quality.

---

## How to add a new pipeline step

1. Add a new stage label + progress update call in `pipeline.py:run_job()`.
2. Add corresponding column to `db.py:SCHEMA_SQL` and `_UPDATE_FIELDS`.
3. Expose it in `main.py:get_result()` response shape.
4. Read it in `contributionPipeline.ts:fetchContributionResult()`.
5. Display it in `Contribute.tsx` Step 2/3 or `ContentDetail.tsx`.

---

## How to add a new page

1. Create `src/pages/NewPage.tsx`.
2. Add route in `src/App.tsx`. Wrap with `<RequireAuth>` if authentication is needed.
3. Add sidebar link in `src/components/dashboard/Sidebar.tsx` or `StudioSidebar.tsx`.
4. If it needs contributions data: `const { items, isLoading } = useContributions()` — always show skeleton while loading.

---

## Supabase migration

The migration to add `transcript`, `transcript_segments`, `detected_language` columns to the Supabase `contributions` table:

```bash
# Get your DB password from Supabase Dashboard → Settings → Database
bash scripts/apply-migration.sh <DB_PASSWORD>
```

Or paste `supabase/migrations/20260427000001_add_transcript_to_contributions.sql` directly into the Supabase SQL Editor.

The `addContribution()` function in `contributionsStore.ts` has a graceful fallback — it retries without transcript fields if the columns don't exist yet.
