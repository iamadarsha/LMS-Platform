# Hyvemind Contribution Pipeline (backend)

FastAPI service that powers the existing `/contribute` page:

```
upload video  →  ffmpeg extracts 16 kHz mono WAV
              →  faster-whisper (cloned from GitHub) transcribes locally
              →  Gemini 2.5 Flash analyses the transcript
              →  frontend polls /status, then renders /result
                 in the existing Studio review UI (no UI changes)
```

The video file on disk is the source of truth. A sidecar `job.json` keeps
status, transcript, segments, language, and the Gemini analysis.

## Prerequisites

* Python 3.11+
* `ffmpeg` on your `PATH` (`brew install ffmpeg`)
* A Gemini API key in the project root `.env`:

  ```
  GEMINI_API_KEY="..."
  ```

## Install

The cloned faster-whisper checkout lives at `vendor/faster-whisper` (already
cloned). The backend adds it to `sys.path` at boot, so you do **not** need to
`pip install faster-whisper` — only its runtime deps.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you prefer to install the cloned copy as a package instead, run
`pip install -e ../vendor/faster-whisper` and remove the explicit dep block
from `requirements.txt`.

## Run

```bash
cd backend
source .venv/bin/activate
python main.py
# → http://127.0.0.1:8787
```

The Vite dev server (`bun dev` / `npm run dev`) proxies `/api/*` to this
backend (see `vite.config.ts`), so the frontend just calls `/api/...`.

## Endpoints

| Method | Path                                  | Notes                              |
| ------ | ------------------------------------- | ---------------------------------- |
| POST   | `/api/contributions/upload`           | multipart `file`, `title`. Returns `{ jobId, status }`. |
| GET    | `/api/contributions/{id}/status`      | `{ status, stageLabel, progress, error }` |
| GET    | `/api/contributions/{id}/result`      | transcript + Gemini analysis       |
| GET    | `/api/contributions/{id}/download`    | original video (internal use)      |
| GET    | `/api/health`                         | liveness + config check            |

## Storage layout

```
backend/uploads/contributions/<jobId>/
  ├── original.mp4      # raw upload (source of truth)
  ├── audio.wav         # 16 kHz mono WAV extracted by ffmpeg
  └── job.json          # status, transcript, segments, analysis, timestamps
```

## Configuration

See `.env.example`. Common knobs:

* `WHISPER_MODEL` — `tiny` | `base` | `small` (default) | `medium` | `large-v3`
* `WHISPER_DEVICE` — `auto` (default), `cpu`, or `cuda`
* `WHISPER_COMPUTE_TYPE` — `int8` (CPU default), `float16` (GPU)
* `MAX_UPLOAD_BYTES` — defaults to 500 MB to match the frontend cap
* `CORS_ORIGINS` — comma-separated allowed origins for direct fetches

## Failure handling

* Transcription failure → job goes to `error` status; the UI shows a toast.
* Gemini failure but transcript succeeded → status is `done`, `analysis` is
  `null`, and `error` carries `analysis_unavailable: ...`. The frontend still
  populates the transcript section.
* On startup failure (no ffmpeg / no API key), `/api/health` reports it.
