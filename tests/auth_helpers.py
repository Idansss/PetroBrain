"""JWT helpers for API tests."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt


JWT_SECRET = "test-secret-change-me-32-bytes-minimum"
JWT_ISSUER = "petrobrain-test"
JWT_AUDIENCE = "petrobrain-api-test"


def jwt_settings(**overrides):
    data = {
        "jwt_secret": JWT_SECRET,
        "jwt_public_key": "",
        "jwt_issuer": JWT_ISSUER,
        "jwt_audience": JWT_AUDIENCE,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def mint_token(
    *,
    tenant_id: str = "demo",
    user_id: str = "u1",
    role: str = "engineer",
    allowed_assets: list[str] | None = None,
    secret: str = JWT_SECRET,
    issuer: str = JWT_ISSUER,
    audience: str = JWT_AUDIENCE,
    expires_delta: timedelta = timedelta(hours=1),
) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user_id,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "allowed_assets": ["*"] if allowed_assets is None else allowed_assets,
        "iss": issuer,
        "aud": audience,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def auth_headers(**claims) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_token(**claims)}"}
