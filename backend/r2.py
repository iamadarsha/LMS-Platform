"""Cloudflare R2 storage helpers.

Two access paths are supported:

1. **Native S3** (preferred for streaming/large objects).
   Set R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY (created from the R2 dashboard).

2. **Cloudflare REST API** (works with a `cfat_*` API token).
   Set R2_API_TOKEN. Endpoint:
       PUT  https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket}/objects/{key}
       GET  …same path…
       DELETE …same path…

We auto-pick the strongest available path. If only the cfat_ token is
configured, we use the REST API. Failures are logged and surfaced as a
None return so the pipeline keeps local disk as the source of truth.
"""

from __future__ import annotations

import logging
import mimetypes
import os
import urllib.parse
from pathlib import Path
from typing import Optional

import httpx

log = logging.getLogger("contributions.r2")

_s3_client = None
_s3_bucket = ""


# ─────────────────────────────────────────────────────────────────────────────
# S3 path (boto3)
# ─────────────────────────────────────────────────────────────────────────────


def _get_s3_client():
    global _s3_client, _s3_bucket
    if _s3_client is not None:
        return _s3_client, _s3_bucket

    bucket = os.environ.get("R2_BUCKET", "").strip()
    endpoint = os.environ.get("R2_ENDPOINT", "").strip()
    ak = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    sk = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    if not (bucket and endpoint and ak and sk):
        return None, ""

    import boto3
    from botocore.client import Config

    _s3_client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=ak,
        aws_secret_access_key=sk,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path"},
        ),
    )
    _s3_bucket = bucket
    return _s3_client, _s3_bucket


# ─────────────────────────────────────────────────────────────────────────────
# REST path (cfat_ token)
# ─────────────────────────────────────────────────────────────────────────────


def _rest_config() -> Optional[tuple[str, str, str]]:
    """Return (account_id, bucket, token) if the REST path is usable."""

    bucket = os.environ.get("R2_BUCKET", "").strip()
    account = os.environ.get("R2_ACCOUNT_ID", "").strip()
    token = os.environ.get("R2_API_TOKEN", "").strip()
    if not (bucket and account and token):
        return None
    return account, bucket, token


def _rest_url(account: str, bucket: str, key: str) -> str:
    safe_key = urllib.parse.quote(key, safe="/")
    return (
        f"https://api.cloudflare.com/client/v4/accounts/{account}"
        f"/r2/buckets/{bucket}/objects/{safe_key}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Public surface
# ─────────────────────────────────────────────────────────────────────────────


def is_configured() -> bool:
    s3_client, _ = _get_s3_client()
    if s3_client is not None:
        return True
    return _rest_config() is not None


def upload_file(local_path: Path, key: str, *, content_type: Optional[str] = None) -> Optional[str]:
    """Upload a local file. Returns the object key on success, None on failure."""

    if not local_path.exists():
        log.warning("upload_file: missing source %s", local_path)
        return None

    if content_type is None:
        content_type, _ = mimetypes.guess_type(local_path.name)
    content_type = content_type or "application/octet-stream"

    # Prefer S3 path when available — better for large/streaming uploads.
    s3_client, s3_bucket = _get_s3_client()
    if s3_client is not None:
        try:
            s3_client.upload_file(
                str(local_path), s3_bucket, key, ExtraArgs={"ContentType": content_type}
            )
            log.info("R2/S3 uploaded %s → %s/%s", local_path.name, s3_bucket, key)
            return key
        except Exception:
            log.exception("R2/S3 upload failed; trying REST fallback")

    rest = _rest_config()
    if rest is None:
        return None
    account, bucket, token = rest
    url = _rest_url(account, bucket, key)
    try:
        with local_path.open("rb") as f:
            r = httpx.put(
                url,
                content=f.read(),
                headers={"Authorization": f"Bearer {token}", "Content-Type": content_type},
                timeout=300.0,
            )
        if r.status_code >= 400:
            log.error("R2/REST PUT failed (%s): %s", r.status_code, r.text[:300])
            return None
        log.info("R2/REST uploaded %s → %s/%s", local_path.name, bucket, key)
        return key
    except Exception:
        log.exception("R2/REST upload failed for key=%s", key)
        return None


def presign_get(key: str, *, expires_in: int = 3600) -> Optional[str]:
    """Best-effort presigned URL.

    Only available via the S3 path. The REST API doesn't issue presigned
    URLs, so callers should fall back to streaming through the backend
    (e.g. a redirect to /api/contributions/{id}/download) when this is
    None.
    """

    s3_client, s3_bucket = _get_s3_client()
    if s3_client is None or not key:
        return None
    try:
        return s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": s3_bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception:
        log.exception("R2 presign failed for key=%s", key)
        return None


def fetch_object_bytes(key: str) -> Optional[bytes]:
    """REST-path fallback for downloading an object."""

    s3_client, s3_bucket = _get_s3_client()
    if s3_client is not None:
        try:
            obj = s3_client.get_object(Bucket=s3_bucket, Key=key)
            return obj["Body"].read()
        except Exception:
            log.exception("R2/S3 fetch failed key=%s; trying REST", key)

    rest = _rest_config()
    if rest is None:
        return None
    account, bucket, token = rest
    url = _rest_url(account, bucket, key)
    try:
        r = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=300.0)
        if r.status_code >= 400:
            return None
        return r.content
    except Exception:
        log.exception("R2/REST fetch failed key=%s", key)
        return None
