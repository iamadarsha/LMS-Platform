"""Upstash Redis client (REST API).

We use the REST surface so we don't need to terminate TLS or open a long-lived
TCP connection from the backend; great for small workloads and matches the
deployment story for serverless platforms later.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

import httpx

log = logging.getLogger("contributions.cache")


def _config() -> tuple[str, str] | None:
    url = os.environ.get("UPSTASH_REDIS_REST_URL", "").strip().rstrip("/")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "").strip()
    if not url or not token:
        return None
    return url, token


def is_configured() -> bool:
    return _config() is not None


def _request(parts: list[str | int]) -> Any:
    cfg = _config()
    if cfg is None:
        return None
    url, token = cfg
    try:
        r = httpx.post(
            url,
            json=[str(p) for p in parts],
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        if r.status_code >= 400:
            log.warning("Upstash %s → %s", parts[0], r.status_code)
            return None
        return r.json().get("result")
    except Exception:
        log.exception("Upstash request failed: %s", parts[0])
        return None


def set_json(key: str, value: Any, *, ttl_seconds: int = 30) -> None:
    payload = json.dumps(value)
    if ttl_seconds > 0:
        _request(["SET", key, payload, "EX", ttl_seconds])
    else:
        _request(["SET", key, payload])


def get_json(key: str) -> Optional[Any]:
    raw = _request(["GET", key])
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def incr_with_ttl(key: str, *, ttl_seconds: int = 60) -> int:
    val = _request(["INCR", key])
    if val is None:
        return 0
    if int(val) == 1:
        _request(["EXPIRE", key, ttl_seconds])
    return int(val)


def now_minute_bucket() -> int:
    return int(time.time() // 60)


def rate_limit_check(user_id: str, *, limit: int = 30, window_seconds: int = 60) -> bool:
    """Return True if the user is within the limit, False to reject."""

    if not is_configured():
        return True  # fail-open when Redis isn't configured
    bucket = now_minute_bucket()
    key = f"hyvemind:rl:{user_id}:{bucket}"
    count = incr_with_ttl(key, ttl_seconds=window_seconds + 5)
    return count <= limit
