"""
End-to-end Postgres smoke (Tier 2 capstone).

Drives the REAL API routes with PB_PERSISTENCE_BACKEND=postgres and no factory
monkeypatching, proving the full swap works through the app layer (auth ->
routes -> Postgres repos -> RLS), not just per-repo. Runs only when
PB_TEST_DATABASE_URL is set; skipped otherwise.

The whole app is flipped to Postgres by setting env + clearing the get_settings
LRU cache (deps and the repo factories both read app.config.get_settings). The
app connects as a NOSUPERUSER role so RLS is exercised end-to-end.
"""
import os
import sys
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from tests.auth_helpers import JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET, auth_headers

ADMIN_DSN = os.getenv("PB_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not ADMIN_DSN,
    reason="PB_TEST_DATABASE_URL not set; Postgres integration tests skipped",
)

APP_ROLE = "petrobrain_app"
APP_PASSWORD = "apppw_test"  # noqa: S105 - test-only, ephemeral CI/dev database

_TABLES = ("tenants", "users", "assets", "asset_relationships", "documents",
           "admin_documents", "mrv_inventories", "audit_events")


def _app_dsn(admin_dsn: str) -> str:
    from app.db import pg

    parts = urlsplit(pg.normalize_dsn(admin_dsn))
    netloc = f"{APP_ROLE}:{APP_PASSWORD}@{parts.hostname}:{parts.port or 5432}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    import app.config as config
    from app.db import pg

    admin = pg.normalize_dsn(ADMIN_DSN)
    with pg.connect(admin) as conn:
        pg.apply_migrations(conn)
        conn.execute(
            f"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='{APP_ROLE}') "
            f"THEN CREATE ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}' NOSUPERUSER; END IF; END $$;"
        )
        conn.execute(f"ALTER ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}' NOSUPERUSER")
        conn.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
        conn.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}")
        conn.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}")
        conn.execute(f"TRUNCATE {', '.join(_TABLES)} CASCADE")

    env = {
        "PB_PERSISTENCE_BACKEND": "postgres",
        "PB_DATABASE_URL": _app_dsn(ADMIN_DSN),
        "PB_JWT_SECRET": JWT_SECRET,
        "PB_JWT_ISSUER": JWT_ISSUER,
        "PB_JWT_AUDIENCE": JWT_AUDIENCE,
    }
    saved = {k: os.environ.get(k) for k in env}
    os.environ.update(env)
    config.get_settings.cache_clear()
    try:
        from app.main import app

        yield TestClient(app)
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        config.get_settings.cache_clear()


def _platform(**kw):
    return auth_headers(tenant_id=kw.pop("tenant_id", "__platform__"), user_id="owner",
                        role="platform_admin", allowed_assets=["*"], **kw)


def _admin(tenant_id="tenant-a", **kw):
    return auth_headers(tenant_id=tenant_id, user_id="alice", role="admin",
                        allowed_assets=["*"], **kw)


def test_health_and_tenant_user_lifecycle(client):
    assert client.get("/health").status_code == 200

    assert client.post("/admin/tenants", headers=_platform(),
                       json={"id": "tenant-a", "name": "Operator A"}).status_code == 201
    assert client.post("/admin/tenants", headers=_platform(),
                       json={"id": "tenant-b", "name": "Operator B"}).status_code == 201

    listing = client.get("/admin/tenants", headers=_platform()).json()
    assert {t["id"] for t in listing["tenants"]} == {"tenant-a", "tenant-b"}

    inv = client.post("/admin/tenants/tenant-a/users", headers=_admin(),
                      json={"email": "bob@op.com", "role": "engineer"})
    assert inv.status_code == 201, inv.text
    assert inv.json()["status"] == "invited"

    users = client.get("/admin/tenants/tenant-a/users", headers=_admin()).json()
    assert {u["email"] for u in users["users"]} == {"bob@op.com"}


def test_assets_through_api_with_tenant_isolation(client):
    client.post("/admin/tenants", headers=_platform(), json={"id": "tenant-a", "name": "A"})
    client.post("/admin/tenants", headers=_platform(), json={"id": "tenant-b", "name": "B"})

    field = client.post("/assets", headers=_admin("tenant-a"),
                        json={"type": "field", "name": "Niger-Delta", "asset_id": "field-a"})
    assert field.status_code == 201, field.text
    client.post("/assets", headers=_admin("tenant-a"),
                json={"type": "block", "name": "OML-99", "parent_id": "field-a", "asset_id": "block-a"})
    # a different tenant's asset must not leak into tenant-a's listing
    client.post("/assets", headers=_admin("tenant-b"),
                json={"type": "field", "name": "Other", "asset_id": "field-b"})

    a_assets = client.get("/assets", headers=_admin("tenant-a")).json()
    ids = {a["id"] for a in a_assets["assets"]}
    assert ids == {"field-a", "block-a"}
    assert "field-b" not in ids

    desc = client.get("/assets/field-a/descendants", headers=_admin("tenant-a")).json()
    assert {a["id"] for a in desc["descendants"]} == {"block-a"}


def test_read_routes_over_postgres(client):
    client.post("/admin/tenants", headers=_platform(), json={"id": "tenant-a", "name": "A"})
    client.post("/assets", headers=_admin("tenant-a"),
                json={"type": "field", "name": "F", "asset_id": "field-a"})

    audit = client.get("/admin/audit?tenant_id=tenant-a", headers=_platform())
    assert audit.status_code == 200
    assert audit.json()["count"] == 0  # no chat ran; exercises the query path

    readiness = client.get("/admin/data-readiness?tenant_id=tenant-a", headers=_platform()).json()
    assert "readiness_pct" in readiness
    assert readiness["assets"]["total"] == 1

    assert client.get("/emissions/inventories", headers=_admin("tenant-a")).json() == {"inventories": []}
    assert client.get("/documents", headers=_admin("tenant-a")).json() == {"documents": []}
    assert client.get("/admin/documents", headers=_admin("tenant-a")).json() == {"documents": []}
