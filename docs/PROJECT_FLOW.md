# Hyvemind — Project & User Flow

## User Journeys

### 1. Discovery (unauthenticated)
```
Landing → Browse Explore page → Watch any public content detail
           (contentLibrary seed data + published Supabase contributions)
```

### 2. Sign In
```
Click "Sign In" → /signin → Clerk embedded UI (Google / GitHub OAuth or email)
→ Clerk issues session JWT → RequireAuth gate → redirect to intended page
```

### 3. Watch a Video
```
Click card → /content/:slug
  → useContributions() resolves slug to ContentEntry
  → VideoPlayer renders poster → user clicks Play
  → Native <video> or <iframe> (YouTube/Vimeo) loads
  → onCurrentTime fires at 4fps → TranscriptPanel highlights active segment
  → Watch progress auto-saves every 5s to Supabase watch_progress
  → CC button toggles native <track> subtitles (VTT blob) + expands TranscriptPanel
```

### 4. Contribute a Video
```
/studio/contribute (auth required)
  Step 0 — Resource basics
    → Title, category, thumbnail style, tags
  Step 1 — Upload + Processing
    → Drop video → POST /api/contributions/upload (multipart, Clerk JWT)
    → Backend saves to disk → creates Neon row → starts background pipeline
    → Frontend polls /status every 3s → progress bar updates
    Pipeline stages:
      18% extracting_audio → ffmpeg 16kHz WAV
      42% transcribing     → faster-whisper (→ Gemini fallback if unavailable)
      68% transcript ready → saved to Neon
      72% uploading        → R2 (original + audio)
      85% analyzing        → Gemini 2.5 Flash structured JSON
      100% done            → analysis saved to Neon
  Step 2 — Transcript review
    → fetchContributionResult() loads transcript + segments + AI analysis
    → User can read/verify the auto-generated transcript
  Step 3 — Review & edit AI output
    → Editable: title, summary, tags, steps
    → Preview card shows what the published entry will look like
  Step 4 — Publish
    → POST /api/contributions/:id/publish → marks is_published=true in Neon
    → addContribution() writes full ContentEntry to Supabase public feed
    → toast "Published!" → redirect to /content/:slug
```

### 5. Progress Tracking
```
Home "Continue Watching" → useWatchProgress() from Supabase
MyProgress page → streak, total watch time, completed count, weekly goal
  (all derived from watch_progress rows — no hardcoded data)
```

---

## Contribution Pipeline (detail)

```
POST /api/contributions/upload
  │
  ├── Rate limit check (20/min via Redis)
  ├── Create Neon row (status: queued)
  ├── Save file to disk (backend/uploads/<job_id>/original.mp4)
  └── BackgroundTask: pipeline.run_job(job_id)
        │
        ├── ffmpeg: extract audio.wav (16kHz mono PCM)
        ├── _transcribe():
        │     try → faster-whisper (beam_size=1, VAD filter)
        │     catch → Gemini Files API transcription (fallback)
        ├── _render_pretty_transcript(): group segments into [mm:ss] paragraphs
        ├── R2 upload: original + audio (skipped if R2 not configured)
        └── _analyze_with_gemini():
              Gemini 2.5 Flash → JSON:
                title, summary, tags, topics, keyTakeaways, actionItems,
                notableInsights, qualityFlags, chapters, steps
              (non-fatal: job completes with transcript even if Gemini fails)
```

---

## State Machine (Contribution Job)

```
queued → extracting_audio → transcribing → [uploading] → analyzing → done
                                                                       ↓
                                                                    error (at any stage)
```

Jobs in `done` state can be published. `error` jobs show the error message in the Studio Dashboard.

---

## Real-time Features

| Feature | Mechanism |
|---------|-----------|
| Processing progress bar | 3s polling of `/api/contributions/:id/status` |
| Live transcript sync | `onTimeUpdate` → `onCurrentTime` prop (throttled 250ms) → `TranscriptPanel.findActiveIndex` |
| CC subtitles (on-video) | Native `<track kind="subtitles">` with VTT blob generated from segments |
| Auto-scroll in transcript | `scrollIntoView({behavior:"smooth"})` gated by 1.5s user-scroll lockout |
| Watch progress save | 5s interval debounce via `upsertWatchProgress()` |
