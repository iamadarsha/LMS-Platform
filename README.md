<div align="center">

# 🐝 Hyvemind

### *Turn any video into a structured, searchable, AI-curated learning hub.*

[![Stack](https://img.shields.io/badge/stack-React%20%2B%20FastAPI-8b5cf6?style=for-the-badge)](#-tech-stack)
[![AI](https://img.shields.io/badge/AI-Whisper%20%2B%20Gemini%202.5-f59e0b?style=for-the-badge)](#-the-ai-pipeline)
[![Storage](https://img.shields.io/badge/storage-Cloudflare%20R2-f97316?style=for-the-badge)](#-architecture)
[![Auth](https://img.shields.io/badge/auth-Clerk-6366f1?style=for-the-badge)](#-tech-stack)
[![One-Command](https://img.shields.io/badge/install-one_command-22c55e?style=for-the-badge)](#-quick-start)

**One command. Any Mac. From clone to running platform in under 5 minutes.**

[Quick Start](#-quick-start) · [Use Cases](#-who-its-for) · [Architecture](#-architecture) · [Documentation](#-documentation)

</div>

---

## 🎯 What is Hyvemind?

Hyvemind is a **dark-themed AI knowledge library** built for teams and individuals who learn by watching. Drop in any how-to video, and within minutes Hyvemind:

🎤 **Transcribes** it locally with `faster-whisper` (with automatic Gemini fallback when Whisper struggles)
🧠 **Analyses** the transcript with Gemini 2.5 Flash — generating polished titles, summaries, tags, chapters, key takeaways, and step-by-step instructions
✨ **Publishes** the result as a beautiful, scrollable card with **Apple Music-style live transcript sync**, native CC subtitles, watch-progress tracking, and one-tap segment seeking

It's the bridge between *"I'll watch that later"* and *"I already know what's in there and exactly where the bit I want lives."*

---

## ⚡ Quick Start

### 🍎 On a fresh Mac — one command

```bash
git clone https://github.com/iamadarsha/LMS-Platform.git && cd LMS-Platform
cp .env.example .env       # paste your credentials inside
bash setup.sh
```

That's it. `setup.sh` will:

| Step | Action |
|------|--------|
| 1️⃣ | Install **Homebrew** if missing |
| 2️⃣ | Install **Node.js**, **Python 3**, **ffmpeg** via brew |
| 3️⃣ | Run `npm install` for the React frontend |
| 4️⃣ | Create the Python virtualenv + `pip install` everything |
| 5️⃣ | Validate your `.env` (warns on placeholder values) |
| 6️⃣ | Boot **FastAPI** on `127.0.0.1:8787` |
| 7️⃣ | Boot **Vite dev server** on `localhost:8080` |
| 8️⃣ | Auto-open your browser |

Press `Ctrl+C` to stop both services cleanly.

> **Subsequent runs:** `bash setup.sh --run` skips bootstrap (3 sec to start)
> **Bootstrap only:** `bash setup.sh --setup`

### 🔑 Where to get each credential

`.env.example` documents every credential inline with dashboard links. TL;DR:

| Service | Dashboard | What you need |
|---------|-----------|---------------|
| 🔐 **Clerk** *(auth)* | [dashboard.clerk.com](https://dashboard.clerk.com) → API Keys | Publishable + Secret + Frontend API URL |
| 🗄️ **Supabase** *(public feed)* | [supabase.com/dashboard](https://supabase.com/dashboard) → Settings → API | URL + anon key |
| 🤖 **Gemini** *(AI brain)* | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | API key |
| 🐘 **Neon** *(Postgres)* | [console.neon.tech](https://console.neon.tech) → Connection Details | Pooled connection string |
| ⚡ **Upstash** *(Redis)* | [console.upstash.com](https://console.upstash.com) → REST API | REST URL + token |
| ☁️ **Cloudflare R2** *(video storage)* | [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → API Tokens | Account ID + Access Key + Secret |

### 🧱 First-time Supabase migration

```bash
SUPABASE_PAT=sbp_...  SUPABASE_PROJECT_REF=YOUR-REF  bash scripts/apply-migrations.sh
```

Applies all 8 migrations (contributions, watch_progress, profiles, transcript columns, RLS policies) via the Supabase Management API. **No DB password required.**

---

## ✨ Key Features

<table>
<tr>
<td width="33%" valign="top">

### 🎬 Smart Pipeline
Upload → ffmpeg audio extraction → faster-whisper transcription → R2 storage → Gemini 2.5 Flash structured analysis → publish. Every step observable in real time.

</td>
<td width="33%" valign="top">

### 📝 Live Synced Transcript
Apple-Music-style transcript that scrolls with the playhead. Click any line to jump. Native HTML5 `<track>` for in-video CC subtitles.

</td>
<td width="33%" valign="top">

### 🛟 Failsafe Transcription
Whisper failed? The pipeline silently falls back to **Gemini Files API** for transcription. Zero manual intervention. Top-grade quality either way.

</td>
</tr>
<tr>
<td valign="top">

### 🔐 Production Auth
Clerk-powered sign-in (Google, GitHub, email). JWKS-verified bearer tokens on FastAPI. Per-user data isolation via owner-scoped queries.

</td>
<td valign="top">

### 🗄️ Multi-Store by Design
**Neon Postgres** for private state. **Supabase** for the public feed. **R2** for video. **Upstash Redis** for caching and rate limits. Each layer does one job well.

</td>
<td valign="top">

### 🌍 Cross-User Visibility
Every published video is instantly visible to all signed-in users. RLS-enforced public feed; presigned R2 URLs scoped per request.

</td>
</tr>
<tr>
<td valign="top">

### 🎨 Crafted UI
shadcn/ui + Tailwind. Neon-violet on deep navy, blueprint-grid backgrounds, scroll-revealed sections, motion that respects `prefers-reduced-motion`.

</td>
<td valign="top">

### 📊 Watch Progress
Resume where you left off. "Continue Watching" rail on the home feed. Streak tracking, total watch time, completion stats — all derived from real activity.

</td>
<td valign="top">

### 🚀 One-Command Boot
`bash setup.sh` on a fresh Mac. Installs brew, node, python, ffmpeg, all dependencies, both services. From clone to running app in <5 min.

</td>
</tr>
</table>

---

## 👥 Who It's For

### 🏢 For Companies & Teams

<table>
<tr><td valign="top">

#### 🎓 Internal Training & Onboarding
- Record once, search forever. New hires watch the same Loom recording but see chapters, takeaways, and clickable transcript timestamps.
- Tribal knowledge becomes structured wiki content automatically — no one writes a doc afterward.

#### 🤝 Customer Education
- Turn webinar recordings into a searchable academy.
- Each video gets auto-generated summary cards for the LMS landing page.
- Customers find the 90-second clip they need instead of scrubbing through a 45-min recording.

</td><td valign="top">

#### 🛠️ Engineering Knowledge Base
- Architecture walkthroughs, demo days, RFC presentations — drop them in and they become structured docs with chapters and key decisions.
- Smart engineers won't write notes; this writes them automatically.

#### 📞 Sales Enablement
- Top performers' demo recordings become a searchable playbook.
- "How does Sarah handle the security objection?" → click to the 23s segment.

</td></tr>
<tr><td valign="top">

#### 🎯 Product Marketing
- Customer testimonials → tagged, summarised, and clipped automatically.
- Quote-mineable transcripts ready for case studies and social posts.

</td><td valign="top">

#### 🏥 Compliance & Audit
- Every training recording gets a verbatim transcript with timestamps. Auditable evidence for HR/regulatory/SOC2.

</td></tr>
</table>

### 👤 For Individuals & Creators

<table>
<tr><td valign="top">

#### 📚 Personal Learning Library
- YouTube tutorial → full transcript with chapters → cliffsnotes you'll actually re-read.
- Build a private Netflix of your own learning, fully indexed.

#### ✍️ Content Creators
- Repurpose 1 video into 10 derivative assets: clips, quote graphics, blog posts, Twitter threads, newsletter sections.
- AI-generated chapters mean YouTube descriptions write themselves.

</td><td valign="top">

#### 🎙️ Podcasters
- Drop episode audio in. Get show notes, chapter markers, key takeaways, and quote-mineable transcripts. Ready for Substack/Spotify.

#### 🎓 Students & Researchers
- Lecture recordings become study guides. Search 40 hours of class video by topic.
- Interview audio → structured transcript with speaker timing.

</td></tr>
<tr><td valign="top">

#### 💼 Coaches & Consultants
- Client session recordings → automatic summaries delivered as deliverables.
- Build a paid course from a YouTube playlist in an afternoon.

</td><td valign="top">

#### 🎬 Documentary Makers
- Hours of B-roll interview footage → searchable transcript archive.
- Find every clip where someone says X across 200 hours of source.

</td></tr>
</table>

---

## 🧠 The AI Pipeline

```mermaid
flowchart LR
    A[📹 Video Upload] --> B[🔊 ffmpeg<br/>16kHz mono WAV]
    B --> C{🎤 Whisper<br/>Transcribe}
    C -->|✅ success| E[📝 Pretty Transcript<br/>Segments + paragraphs]
    C -->|❌ failure| D[🤖 Gemini Files API<br/>Fallback]
    D --> E
    E --> F[☁️ Cloudflare R2<br/>Video + Audio]
    F --> G[✨ Gemini 2.5 Flash<br/>Structured Analysis]
    G --> H[📚 Title • Summary • Tags<br/>Chapters • Steps • Insights]
    H --> I[🌍 Publish to Public Feed]

    style A fill:#8b5cf6,stroke:#fff,color:#fff
    style I fill:#22c55e,stroke:#fff,color:#fff
    style C fill:#f59e0b,stroke:#fff,color:#fff
    style D fill:#f59e0b,stroke:#fff,color:#fff
    style G fill:#6366f1,stroke:#fff,color:#fff
```

### Whisper config — top-grade quality
- Model `small` (CPU-friendly, excellent accuracy)
- `beam_size=5` — full beam search, not greedy decode
- VAD with `speech_pad_ms=200` — no clipped word onsets
- `condition_on_previous_text=True` — consistent terminology
- `initial_prompt` seeded with the user-supplied title for proper-noun spelling

### Gemini config
- `gemini-2.5-flash`, `temperature=0.0`, response forced to JSON
- Vocab-hinted from the contribution title for accurate brand/proper-noun spelling
- Returns: `title, summary, tags, topics, keyTakeaways, actionItems, notableInsights, qualityFlags, chapters[], steps[]`

### Real-world numbers
| Video | Size | Pipeline time | Segments | Output |
|-------|------|---------------|----------|--------|
| 11 MB Figma plugins demo | 480p, ~7 min | **85 seconds** | 54 segments | 8 chapters, 8 steps, 8 tags |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (React + Vite)                     │
│                                                                     │
│   Clerk Auth      Supabase JS (anon)      fetch(/api/...)           │
└────────┬───────────────┬──────────────────────┬─────────────────────┘
         │               │                      │
         ▼               ▼                      ▼
   ┌──────────┐   ┌──────────────┐     ┌──────────────────┐
   │  Clerk   │   │   Supabase   │     │  FastAPI :8787   │
   │ (OAuth)  │   │ public feed  │     │  (Clerk JWT)     │
   └──────────┘   │  watch_prog  │     └────┬─────────────┘
                  │  profiles    │          │
                  └──────────────┘          │
                                            ▼
                          ┌─────────────────────────────────────┐
                          │          Backend Services           │
                          │                                     │
                          │  Neon Postgres   ← pipeline state   │
                          │  Cloudflare R2   ← video / audio    │
                          │  Upstash Redis   ← cache + ratelim  │
                          │  Gemini API      ← transcribe + AI  │
                          │  faster-whisper  ← local transcribe │
                          │  ffmpeg          ← audio extract    │
                          └─────────────────────────────────────┘
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the per-module deep dive.

---

## 🧰 Tech Stack

| Layer | Tooling |
|-------|---------|
| **Frontend** | React 18 · TypeScript strict · Vite · Tailwind CSS · shadcn/ui · Clerk |
| **Backend** | Python 3.10+ · FastAPI · uvicorn · Pydantic · psycopg3 |
| **AI / ML** | faster-whisper *(vendored)* · Google Gemini 2.5 Flash · ffmpeg |
| **Data** | Neon Postgres · Supabase Postgres · Cloudflare R2 · Upstash Redis |
| **Auth** | Clerk *(frontend)* · Clerk JWKS verification *(backend)* |
| **Hosting** | Vercel-ready frontend · Railway/Render-ready backend |

---

## 📁 Repo Layout

```
.
├── 🌐 src/                     React frontend
│   ├── pages/                 Route-level components
│   ├── components/            Reusable UI (shadcn/ui + custom)
│   ├── data/                  Stores, API clients, content models
│   └── integrations/          Supabase typed client
├── ⚙️  backend/                 FastAPI service (port 8787)
│   ├── main.py                Routes + lifespan
│   ├── pipeline.py            Whisper → R2 → Gemini orchestration
│   ├── auth.py                Clerk JWKS verification
│   ├── db.py                  Neon Postgres CRUD with retry
│   ├── r2.py                  Cloudflare R2 (S3 SDK + REST fallback)
│   └── cache.py               Upstash Redis REST
├── 📦 vendor/faster-whisper/  Vendored — no clone needed
├── 🗃️  supabase/migrations/    Public-feed schema + RLS (8 migrations)
├── 📖 docs/                    ARCHITECTURE / PROJECT_FLOW / HANDOVER / DESIGN_SYSTEM
└── 🛠️  scripts/                start.sh, apply-migrations.sh
```

---

## 📖 Documentation

| Doc | Purpose |
|-----|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Service topology, data flow, env vars |
| [`docs/PROJECT_FLOW.md`](docs/PROJECT_FLOW.md) | User journeys + pipeline state machine |
| [`docs/HANDOVER.md`](docs/HANDOVER.md) | AI-readable context, conventions, known debt |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Color tokens, typography, animation system |

---

## 🛡️ Security Model

- All `/api/contributions/*` endpoints require a valid Clerk session JWT
- R2 keys are scoped per Clerk user id (`users/{user_id}/contributions/{job_id}/...`)
- Public video URLs are presigned on demand and only resolve for `is_published=true` contributions
- Supabase RLS policies enforce per-user write access on `contributions`, `watch_progress`, `profiles`
- Cross-user **read** access is allowed for `status='published'` contributions (the public feed)
- `.env` is gitignored — only `.env.example` is committed
- Neon connection pool uses `check_connection` to never hand out dead connections

---

## 🩺 Health Check

```bash
curl http://127.0.0.1:8787/api/health
# {
#   "ok": true,
#   "geminiConfigured": true,    # ← Gemini API key present
#   "clerkConfigured": true,     # ← Clerk JWKS reachable
#   "whisperVendored": true,     # ← vendor/faster-whisper exists
#   "ffmpeg": true,              # ← ffmpeg on PATH
#   "r2Configured": true,        # ← R2 credentials present
#   "redisConfigured": true,     # ← Upstash Redis reachable
#   "dbConfigured": true         # ← Neon Postgres reachable
# }
```

All seven must be `true` for the platform to function fully. If any are `false`, your `.env` is missing that credential.

---

## 🐛 Troubleshooting

| Symptom | Fix |
|---------|-----|
| `bash setup.sh` says "field looks like a placeholder" | Open `.env` and replace the `YOUR_*` values |
| Health: `clerkConfigured: false` | `CLERK_JWKS_URL` / `CLERK_ISSUER` wrong — copy Frontend API URL from Clerk dashboard exactly |
| Health: `dbConfigured: false` | `DATABASE_URL` wrong, or Neon DB suspended — check console.neon.tech |
| Health: `r2Configured: false` | `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` not set, or wrong bucket name |
| Upload returns 500 | `tail /tmp/hyvemind-backend.log` — usually first-ever run downloading Whisper model (~75MB, one-time) |
| "Object exceeds maximum size" on publish | Pipeline didn't complete — wait for `status: done` before clicking Publish |
| Cross-user video doesn't play | Ensure user has clicked Publish (check `is_published=true` in Neon) |

---

## 🗺️ Roadmap

- [ ] 🎵 Word-level transcript karaoke highlighting *(data already captured)*
- [ ] 🔍 Cross-contribution semantic search *(pgvector + Gemini embeddings)*
- [ ] 👥 Live collaborative watch parties
- [ ] 📱 Mobile app *(React Native / Expo)*
- [ ] 🌐 Public publishing API for third-party contributors
- [ ] 🧠 AI study questions auto-generated per chapter
- [ ] 📊 Team analytics dashboard *(who's watched what, completion %)*

---

## 🤝 Contributing

Bug reports and PRs welcome. Before submitting:

```bash
npx tsc --noEmit -p tsconfig.app.json    # frontend type check
cd backend && python -m py_compile *.py  # backend syntax
```

---

## 📄 License

MIT.

---

<div align="center">

**Built with care for people who learn by watching.**

⭐ Star this repo if Hyvemind saves you time.

</div>
