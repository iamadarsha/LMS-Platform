"""Clerk JWT verification.

We trust the session token issued by the user's Clerk instance. Public keys
are fetched from Clerk's JWKS endpoint and cached in-process.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status

log = logging.getLogger("contributions.auth")

_JWKS_CACHE: dict | None = None
_JWKS_CACHE_AT: float = 0.0
_JWKS_TTL = 60 * 60  # 1 hour
_LOCK = threading.Lock()


def _jwks_url() -> str:
    url = os.environ.get("CLERK_JWKS_URL", "").strip()
    if url:
        return url
    issuer = os.environ.get("CLERK_ISSUER", "").strip().rstrip("/")
    if not issuer:
        raise RuntimeError("CLERK_JWKS_URL or CLERK_ISSUER must be set")
    return f"{issuer}/.well-known/jwks.json"


def _get_jwks() -> dict:
    global _JWKS_CACHE, _JWKS_CACHE_AT
    now = time.time()
    if _JWKS_CACHE and now - _JWKS_CACHE_AT < _JWKS_TTL:
        return _JWKS_CACHE
    with _LOCK:
        if _JWKS_CACHE and time.time() - _JWKS_CACHE_AT < _JWKS_TTL:
            return _JWKS_CACHE
        url = _jwks_url()
        log.info("Fetching Clerk JWKS from %s", url)
        resp = httpx.get(url, timeout=10.0)
        resp.raise_for_status()
        _JWKS_CACHE = resp.json()
        _JWKS_CACHE_AT = time.time()
        return _JWKS_CACHE


@dataclass(frozen=True)
class ClerkUser:
    user_id: str
    session_id: Optional[str]
    email: Optional[str]
    raw: dict


def _public_key_for(kid: str):
    jwks = _get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key)
    # Force a refresh once in case a new key was rotated in.
    global _JWKS_CACHE_AT
    _JWKS_CACHE_AT = 0.0
    jwks = _get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key)
    raise HTTPException(status_code=401, detail="Unknown signing key")


def verify_clerk_token(token: str) -> ClerkUser:
    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Malformed token: {e}") from e

    kid = unverified.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing kid")

    public_key = _public_key_for(kid)
    issuer = os.environ.get("CLERK_ISSUER", "").strip().rstrip("/")
    try:
        # Clerk session tokens don't carry a fixed `aud` for the default template.
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=issuer or None,
            options={"verify_aud": False},
            leeway=30,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Invalid issuer")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    return ClerkUser(
        user_id=user_id,
        session_id=claims.get("sid"),
        email=claims.get("email"),
        raw=claims,
    )


def require_user(request: Request) -> ClerkUser:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")
    return verify_clerk_token(token)


# FastAPI dependency alias for clarity at call sites.
CurrentUser = Depends(require_user)
