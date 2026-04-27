"""Neon Postgres-backed contribution store.

Schema:

    users            ─ Clerk user mirror (id is the Clerk user id)
    contributions    ─ one row per upload with status, transcript, analysis

The video file lives on local disk + R2; the row references both.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import uuid
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from typing import Any, Iterator, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

log = logging.getLogger("contributions.db")

_pool: ConnectionPool | None = None
_pool_lock = threading.Lock()

# The pre-existing Hyvemind Neon schema already has a `users` table that uses
# `id uuid` PK and `clerk_id text` as the Clerk identity mapping. We don't
# touch it. The pipeline state lives in our own `contributions` table keyed by
# the Clerk user id directly, so we don't fight the existing FK shape.

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id        text UNIQUE,
    name            text,
    image_url       text,
    created_at      timestamp DEFAULT now(),
    updated_at      timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contributions (
    id                   text PRIMARY KEY,
    user_clerk_id        text NOT NULL,
    status               text NOT NULL DEFAULT 'queued',
    stage_label          text DEFAULT 'Queued',
    progress             integer DEFAULT 0,
    title                text DEFAULT '',
    original_file_name   text NOT NULL,
    original_path        text,
    audio_path           text,
    original_r2_key      text,
    audio_r2_key         text,
    transcript           text,
    transcript_segments  jsonb,
    detected_language    text,
    analysis             jsonb,
    error                text,
    is_published         boolean NOT NULL DEFAULT false,
    published_at         timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- additive migrations for older deployments where these columns don't exist yet
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS contributions_user_idx
    ON contributions (user_clerk_id, created_at DESC);
"""


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is not None:
            return _pool
        url = os.environ.get("DATABASE_URL", "").strip()
        if not url:
            raise RuntimeError("DATABASE_URL is not set")
        # Neon pooled hostnames want pgbouncer-friendly options.
        _pool = ConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row, "autocommit": True},
            timeout=15,
        )
        return _pool


@contextmanager
def conn() -> Iterator[psycopg.Connection]:
    pool = get_pool()
    with pool.connection() as c:
        yield c


def init_schema() -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute(SCHEMA_SQL)
    log.info("Postgres schema ensured")


# ---------------------------------------------------------------------------
# Repos
# ---------------------------------------------------------------------------


def upsert_user(
    *,
    user_id: str,
    email: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    image_url: Optional[str] = None,
) -> None:
    """Mirror a Clerk user into the existing users table (id uuid, clerk_id text)."""

    # `users.name` is NOT NULL in the existing Hyvemind schema, so fall back
    # to email or the Clerk user id when neither name nor email is in the
    # session token claims (default Clerk JWTs only carry sub/sid/iat/exp).
    full_name = (
        " ".join(p for p in [first_name, last_name] if p)
        or email
        or user_id
    )
    image_url = image_url or ""  # existing schema has NOT NULL on image_url
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (clerk_id, name, image_url)
            VALUES (%s, %s, %s)
            ON CONFLICT (clerk_id) DO UPDATE SET
                name       = COALESCE(EXCLUDED.name, users.name),
                image_url  = COALESCE(EXCLUDED.image_url, users.image_url),
                updated_at = now()
            """,
            (user_id, full_name, image_url),
        )


@dataclass
class ContributionRow:
    id: str
    user_clerk_id: str
    status: str
    stage_label: str
    progress: int
    title: str
    original_file_name: str
    original_path: Optional[str] = None
    audio_path: Optional[str] = None
    original_r2_key: Optional[str] = None
    audio_r2_key: Optional[str] = None
    transcript: Optional[str] = None
    transcript_segments: list = field(default_factory=list)
    detected_language: Optional[str] = None
    analysis: Optional[dict] = None
    error: Optional[str] = None
    is_published: bool = False
    published_at: Any = None
    created_at: Any = None
    updated_at: Any = None

    def to_public(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("original_path", None)
        d.pop("audio_path", None)
        if d.get("published_at") is not None:
            d["published_at"] = str(d["published_at"])
        if d.get("created_at") is not None:
            d["created_at"] = str(d["created_at"])
        if d.get("updated_at") is not None:
            d["updated_at"] = str(d["updated_at"])
        return d


def _row_to_obj(row: dict) -> ContributionRow:
    return ContributionRow(
        id=row["id"],
        user_clerk_id=row["user_clerk_id"],
        status=row["status"],
        stage_label=row["stage_label"] or "Queued",
        progress=row["progress"] or 0,
        title=row["title"] or "",
        original_file_name=row["original_file_name"],
        original_path=row.get("original_path"),
        audio_path=row.get("audio_path"),
        original_r2_key=row.get("original_r2_key"),
        audio_r2_key=row.get("audio_r2_key"),
        transcript=row.get("transcript"),
        transcript_segments=row.get("transcript_segments") or [],
        detected_language=row.get("detected_language"),
        analysis=row.get("analysis"),
        error=row.get("error"),
        is_published=bool(row.get("is_published")),
        published_at=row.get("published_at"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(name: str) -> str:
    name = os.path.basename(name or "").strip().replace("\\", "_")
    cleaned = _SAFE_NAME.sub("_", name).strip("._-") or "upload"
    if len(cleaned) > 120:
        root, ext = os.path.splitext(cleaned)
        cleaned = root[: 120 - len(ext)] + ext
    return cleaned


def create_contribution(*, user_id: str, original_file_name: str, title: str) -> ContributionRow:
    job_id = uuid.uuid4().hex
    safe_name = sanitize_filename(original_file_name)
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            INSERT INTO contributions
                (id, user_clerk_id, status, stage_label, progress, title, original_file_name)
            VALUES (%s, %s, 'queued', 'Queued', 0, %s, %s)
            RETURNING *
            """,
            (job_id, user_id, title or "", safe_name),
        )
        row = cur.fetchone()
    return _row_to_obj(row)


_UPDATE_FIELDS = {
    "status",
    "stage_label",
    "progress",
    "title",
    "original_path",
    "audio_path",
    "original_r2_key",
    "audio_r2_key",
    "transcript",
    "transcript_segments",
    "detected_language",
    "analysis",
    "error",
}

_JSON_FIELDS = {"transcript_segments", "analysis"}


def update_contribution(job_id: str, **fields: Any) -> Optional[ContributionRow]:
    fields = {k: v for k, v in fields.items() if k in _UPDATE_FIELDS}
    if not fields:
        return get_contribution(job_id)
    sets = []
    values: list[Any] = []
    for k, v in fields.items():
        if k in _JSON_FIELDS:
            sets.append(f"{k} = %s::jsonb")
            values.append(json.dumps(v) if v is not None else None)
        else:
            sets.append(f"{k} = %s")
            values.append(v)
    sets.append("updated_at = now()")
    values.append(job_id)
    sql = f"UPDATE contributions SET {', '.join(sets)} WHERE id = %s RETURNING *"
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, values)
        row = cur.fetchone()
    return _row_to_obj(row) if row else None


def get_contribution(job_id: str, *, user_id: Optional[str] = None) -> Optional[ContributionRow]:
    with conn() as c, c.cursor() as cur:
        if user_id:
            cur.execute(
                "SELECT * FROM contributions WHERE id = %s AND user_clerk_id = %s",
                (job_id, user_id),
            )
        else:
            cur.execute("SELECT * FROM contributions WHERE id = %s", (job_id,))
        row = cur.fetchone()
    return _row_to_obj(row) if row else None


def publish_contribution(job_id: str, *, user_id: str) -> Optional[ContributionRow]:
    """Mark a contribution as published. Owner-scoped."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE contributions
               SET is_published = true,
                   published_at = COALESCE(published_at, now()),
                   updated_at   = now()
             WHERE id = %s AND user_clerk_id = %s
         RETURNING *
            """,
            (job_id, user_id),
        )
        row = cur.fetchone()
    return _row_to_obj(row) if row else None


def list_contributions(user_id: str, limit: int = 50) -> list[ContributionRow]:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT * FROM contributions WHERE user_clerk_id = %s ORDER BY created_at DESC LIMIT %s",
            (user_id, limit),
        )
        rows = cur.fetchall()
    return [_row_to_obj(r) for r in rows]
