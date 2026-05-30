"""
Postgres backend integration tests for the mrv repository (migration 007).

Runs only when ``PB_TEST_DATABASE_URL`` is set; skipped otherwise.
"""
import os
import sys
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

ADMIN_DSN = os.getenv("PB_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not ADMIN_DSN,
    reason="PB_TEST_DATABASE_URL not set; Postgres integration tests skipped",
)

APP_ROLE = "petrobrain_app"
APP_PASSWORD = "apppw_test"  # noqa: S105 - test-only, ephemeral CI/dev database


def _app_dsn(admin_dsn: str) -> str:
    from app.db import pg

    parts = urlsplit(pg.normalize_dsn(admin_dsn))
    netloc = f"{APP_ROLE}:{APP_PASSWORD}@{parts.hostname}:{parts.port or 5432}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


@pytest.fixture(scope="module")
def app_dsn():
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
        conn.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}"
        )
        conn.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}")
    return _app_dsn(ADMIN_DSN)


@pytest.fixture
def repo(app_dsn):
    from app.db import pg
    from app.db.mrv_repository import PostgresMRVRepository

    with pg.connect(pg.normalize_dsn(ADMIN_DSN)) as conn:
        conn.execute("TRUNCATE mrv_inventories")
    return PostgresMRVRepository(app_dsn)


def _payload(facility="FAC-1"):
    request = {"operator": "Op Co", "asset": "asset-a", "facility_id": facility}
    response = {
        "inventory": {"facility_id": facility, "period": "2026-Q3"},
        "mrv_readiness": {
            "status": "partial", "tier_readiness_pct": 62.5, "gap_count": 3,
            "total_co2e_tonnes": 1234.5, "audit_sha256": "deadbeef",
        },
    }
    return request, response


def test_save_returns_record_with_derived_fields(repo):
    req, resp = _payload()
    rec = repo.save(tenant_id="tenant-a", user_id="u1", request=req, response=resp)
    assert rec.inventory_id
    assert rec.facility_id == "FAC-1"
    assert rec.period == "2026-Q3"
    assert rec.operator == "Op Co"
    assert rec.status == "partial"
    assert rec.tier_readiness_pct == 62.5
    assert rec.gap_count == 3
    assert rec.total_co2e_tonnes == 1234.5
    assert rec.audit_sha256 == "deadbeef"
    assert isinstance(rec.created_utc, str) and rec.created_utc


def test_get_returns_full_payloads(repo):
    req, resp = _payload()
    rec = repo.save(tenant_id="tenant-a", user_id="u1", request=req, response=resp)
    got = repo.get(tenant_id="tenant-a", inventory_id=rec.inventory_id)
    assert got["request"] == req
    assert got["response"] == resp
    assert got["facility_id"] == "FAC-1"


def test_list_records_returns_summaries(repo):
    req, resp = _payload("FAC-1")
    repo.save(tenant_id="tenant-a", user_id="u1", request=req, response=resp)
    req2, resp2 = _payload("FAC-2")
    repo.save(tenant_id="tenant-a", user_id="u1", request=req2, response=resp2)
    rows = repo.list_records(tenant_id="tenant-a")
    assert {r["facility_id"] for r in rows} == {"FAC-1", "FAC-2"}
    assert all("request" not in r and "response" not in r for r in rows)
    assert all("tier_readiness_pct" in r for r in rows)


def test_tenant_isolation_and_rls(repo, app_dsn):
    req, resp = _payload()
    a = repo.save(tenant_id="tenant-a", user_id="u1", request=req, response=resp)
    repo.save(tenant_id="tenant-b", user_id="u2", request=req, response=resp)
    assert repo.get(tenant_id="tenant-b", inventory_id=a.inventory_id) is None
    assert len(repo.list_records(tenant_id="tenant-a")) == 1

    import psycopg

    from app.db import pg

    with psycopg.connect(pg.normalize_dsn(app_dsn), autocommit=True) as conn:
        pg.set_tenant(conn, "tenant-a")
        seen = {r[0] for r in conn.execute("SELECT tenant_id FROM mrv_inventories").fetchall()}
    assert seen == {"tenant-a"}
