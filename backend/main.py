"""FastAPI service for the Hyvemind contribution pipeline.

All `/api/contributions/*` endpoints require a Clerk session bearer token.
Per-user data lives in Neon Postgres; the raw video is stored on local disk
and mirrored to Cloudflare R2.

Endpoints:
    POST /api/contributions/upload          multipart upload (auth)
    GET  /api/contributions/{id}/status     processing state (auth, owner-only)
    GET  /api/contributions/{id}/result     transcript + analysis (auth, owner-only)
    GET  /api/contributions                 list current user's contributions (auth)
    GET  /api/contributions/{id}/download   stream original (auth, owner-only)
    GET  /api/me                            current Clerk user info
    GET  /api/health                        liveness / config check
"""

from __future__ import annotations

import logging
import mimetypes
import os
import shutil
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

# Load .env from project root and backend/.env (override).
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR.parent / ".env")
load_dotenv(_BACKEND_DIR / ".env", override=True)

# Make the cloned faster-whisper checkout importable.
_VENDOR_FW = _BACKEND_DIR.parent / "vendor" / "faster-whisper"
if _VENDOR_FW.exists():
    sys.path.insert(0, str(_VENDOR_FW))

import auth  # noqa: E402
import cache  # noqa: E402
import db  # noqa: E402
import r2  # noqa: E402
from pipeline import run_job  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("contributions.api")

ACCEPTED_EXT = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}
DEFAULT_MAX_BYTES = 500 * 1024 * 1024


def _storage_root() -> Path:
    raw = os.environ.get("STORAGE_DIR", "uploads/contributions")
    p = Path(raw)
    if not p.is_absolute():
        p = _BACKEND_DIR / p
    p.mkdir(parents=True, exist_ok=True)
    return p


_STORAGE = _storage_root()


def _job_dir(job_id: str) -> Path:
    p = _STORAGE / job_id
    p.mkdir(parents=True, exist_ok=True)
    return p


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    try:
        db.init_schema()
    except Exception:
        log.exception("Failed to initialise Postgres schema; continuing")
    yield


app = FastAPI(title="Hyvemind Contributions API", version="2.0.0", lifespan=_lifespan)

origins_raw = os.environ.get("CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080")
origins = [o.strip() for o in origins_raw.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Health / identity
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/api/health")
def health() -> dict:
    db_ok = False
    try:
        with db.conn() as c, c.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
            db_ok = True
    except Exception:
        pass
    return {
        "ok": True,
        "geminiConfigured": bool(os.environ.get("GEMINI_API_KEY", "").strip()),
        "clerkConfigured": bool(
            os.environ.get("CLERK_JWKS_URL") or os.environ.get("CLERK_ISSUER")
        ),
        "whisperVendored": _VENDOR_FW.exists(),
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "r2Configured": r2.is_configured(),
        "redisConfigured": cache.is_configured(),
        "dbConfigured": db_ok,
    }


def _enrich_from_clerk(user_id: str) -> dict:
    """Best-effort fetch of the user's Clerk profile for mirroring into Postgres.

    The default Clerk session token only carries `sub` and `sid`, so we hit
    the Clerk Backend API once on /api/me to fill in name/email/avatar. The
    result is cached in Redis (5 min) so we don't pay the round-trip on
    every page load.
    """
    cache_key = f"hyvemind:clerk-user:{user_id}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    sk = os.environ.get("CLERK_SECRET_KEY", "").strip()
    if not sk:
        return {}
    try:
        import httpx

        r = httpx.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {sk}"},
            timeout=8.0,
        )
        if r.status_code >= 400:
            return {}
        profile = r.json()
        cache.set_json(cache_key, profile, ttl_seconds=300)
        return profile
    except Exception:
        log.exception("Clerk user lookup failed for %s", user_id)
        return {}


@app.get("/api/me")
def me(user: auth.ClerkUser = auth.CurrentUser) -> dict:
    profile = _enrich_from_clerk(user.user_id)

    primary_email_id = profile.get("primary_email_address_id")
    email = user.email
    for ea in profile.get("email_addresses") or []:
        if ea.get("id") == primary_email_id:
            email = ea.get("email_address") or email
            break

    db.upsert_user(
        user_id=user.user_id,
        email=email,
        first_name=profile.get("first_name") or user.raw.get("given_name"),
        last_name=profile.get("last_name") or user.raw.get("family_name"),
        image_url=profile.get("image_url") or user.raw.get("picture"),
    )
    return {
        "userId": user.user_id,
        "email": email,
        "firstName": profile.get("first_name"),
        "lastName": profile.get("last_name"),
        "imageUrl": profile.get("image_url"),
        "username": profile.get("username"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Contributions
# ─────────────────────────────────────────────────────────────────────────────


def _validate_upload(file: UploadFile) -> str:
    name = file.filename or ""
    ext = Path(name).suffix.lower()
    ctype = (file.content_type or "").lower()
    if ext not in ACCEPTED_EXT and not ctype.startswith("video/"):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Accepted: {sorted(ACCEPTED_EXT)}",
        )
    return ext or ".mp4"


@app.post("/api/contributions/upload")
async def upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    user: auth.ClerkUser = auth.CurrentUser,
) -> JSONResponse:
    if not cache.rate_limit_check(user.user_id, limit=20, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many uploads — slow down.")

    db.upsert_user(user_id=user.user_id, email=user.email)

    ext = _validate_upload(file)
    safe_name = db.sanitize_filename(file.filename or f"upload{ext}")
    job = db.create_contribution(user_id=user.user_id, original_file_name=safe_name, title=title or "")

    target = _job_dir(job.id) / f"original{ext}"
    max_bytes = int(os.environ.get("MAX_UPLOAD_BYTES", DEFAULT_MAX_BYTES))
    written = 0
    try:
        with target.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    out.close()
                    target.unlink(missing_ok=True)
                    db.update_contribution(job.id, status="error", error="file too large")
                    raise HTTPException(status_code=413, detail="File exceeds maximum size")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Failed to save upload for job %s", job.id)
        db.update_contribution(job.id, status="error", error=f"upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save upload")

    db.update_contribution(job.id, original_path=str(target), status="queued", progress=8, stage_label="Queued")

    background.add_task(run_job, job.id)

    return JSONResponse({"jobId": job.id, "status": "queued", "originalFileName": safe_name})


def _require_owner(job_id: str, user: auth.ClerkUser):
    job = db.get_contribution(job_id, user_id=user.user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/api/contributions")
def list_my(user: auth.ClerkUser = auth.CurrentUser) -> dict:
    rows = db.list_contributions(user.user_id, limit=50)
    return {"contributions": [r.to_public() for r in rows]}


@app.get("/api/contributions/{job_id}/status")
def get_status(job_id: str, user: auth.ClerkUser = auth.CurrentUser) -> dict:
    cache_key = f"hyvemind:status:{user.user_id}:{job_id}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    job = _require_owner(job_id, user)
    payload = {
        "jobId": job.id,
        "status": job.status,
        "stageLabel": job.stage_label,
        "progress": job.progress,
        "error": job.error,
        "updatedAt": str(job.updated_at) if job.updated_at else None,
    }
    # Cache aggressively for terminal states; briefly for in-flight.
    ttl = 60 if job.status in {"done", "error"} else 2
    cache.set_json(cache_key, payload, ttl_seconds=ttl)
    return payload


@app.get("/api/contributions/{job_id}/result")
def get_result(job_id: str, user: auth.ClerkUser = auth.CurrentUser) -> dict:
    job = _require_owner(job_id, user)
    p = job.to_public()
    return {
        "id": job.id,
        "status": p["status"],
        "originalFileName": p["original_file_name"],
        "title": p["title"],
        "transcript": p.get("transcript") or "",
        "transcriptSegments": p.get("transcript_segments") or [],
        "detectedLanguage": p.get("detected_language"),
        "analysis": p.get("analysis"),
        "summary": (p.get("analysis") or {}).get("summary"),
        "tags": (p.get("analysis") or {}).get("tags") or [],
        "chapters": (p.get("analysis") or {}).get("chapters") or [],
        "suggestions": {
            "title": (p.get("analysis") or {}).get("title"),
            "topics": (p.get("analysis") or {}).get("topics") or [],
            "keyTakeaways": (p.get("analysis") or {}).get("keyTakeaways") or [],
            "actionItems": (p.get("analysis") or {}).get("actionItems") or [],
            "notableInsights": (p.get("analysis") or {}).get("notableInsights") or [],
            "qualityFlags": (p.get("analysis") or {}).get("qualityFlags") or [],
            "steps": (p.get("analysis") or {}).get("steps") or [],
        },
        "videoR2Key": p.get("original_r2_key"),
        "audioR2Key": p.get("audio_r2_key"),
        "isPublished": bool(p.get("is_published")),
        "publishedAt": p.get("published_at"),
        "createdAt": p.get("created_at"),
        "updatedAt": p.get("updated_at"),
        "error": p.get("error"),
    }


@app.post("/api/contributions/{job_id}/publish")
def publish(job_id: str, user: auth.ClerkUser = auth.CurrentUser) -> dict:
    job = _require_owner(job_id, user)
    if job.status != "done":
        raise HTTPException(status_code=409, detail=f"Cannot publish — job status is {job.status!r}")
    updated = db.publish_contribution(job_id, user_id=user.user_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": updated.id,
        "isPublished": updated.is_published,
        "publishedAt": str(updated.published_at) if updated.published_at else None,
    }


@app.get("/api/contributions/{job_id}/video")
def public_video(job_id: str) -> dict:
    """Return a presigned R2 URL for a *published* contribution's video.

    No auth required: published videos are public. We still gate on the
    is_published flag so unpublished content stays private.
    """
    job = db.get_contribution(job_id)
    if not job or not job.is_published:
        raise HTTPException(status_code=404, detail="Not found")
    if not job.original_r2_key:
        raise HTTPException(status_code=404, detail="Video not on R2")
    url = r2.presign_get(job.original_r2_key, expires_in=3600)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to sign URL")
    return {"url": url, "expiresIn": 3600}


@app.get("/api/contributions/{job_id}/download")
def download(job_id: str, user: auth.ClerkUser = auth.CurrentUser):
    job = _require_owner(job_id, user)

    # Prefer a presigned R2 URL when available, fall back to local file.
    if job.original_r2_key:
        url = r2.presign_get(job.original_r2_key, expires_in=300)
        if url:
            return RedirectResponse(url=url, status_code=302)

    if not job.original_path:
        raise HTTPException(status_code=404, detail="File not available")
    path = Path(job.original_path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="File no longer available")
    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(path, media_type=media_type or "application/octet-stream", filename=job.original_file_name)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8787")),
        reload=False,
    )
