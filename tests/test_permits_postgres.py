"""Postgres backend integration tests for the permits repository (008).

Runs only when PB_TEST_DATABASE_URL is set; skipped otherwise.
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
        conn.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}")
        conn.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}")
    return _app_dsn(ADMIN_DSN)


@pytest.fixture
def repo(app_dsn):
    from app.db import pg
    from app.db.permits_repository import PostgresPermitsRepository

    with pg.connect(pg.normalize_dsn(ADMIN_DSN)) as conn:
        conn.execute("TRUNCATE permits")
    return PostgresPermitsRepository(app_dsn)


def test_upsert_and_get(repo):
    rec = repo.upsert(tenant_id="tenant-a", user_id="bob",
                      permit={"id": "p1", "form": {"work": "hot"}, "signatures": [{"name": "Bob"}]})
    assert rec.id == "p1"
    assert rec.tenant_id == "tenant-a"
    assert rec.status == "submitted"
    assert rec.form == {"work": "hot"}
    assert rec.signatures == [{"name": "Bob"}]
    assert rec.created_utc and rec.synced_utc

    got = repo.get(tenant_id="tenant-a", permit_id="p1")
    assert got["form"] == {"work": "hot"}


def test_upsert_is_idempotent_and_updates(repo):
    first = repo.upsert(tenant_id="tenant-a", user_id="bob", permit={"id": "p1", "status": "submitted"})
    repo.upsert(tenant_id="tenant-a", user_id="bob", permit={"id": "p1", "status": "approved"})
    rows = repo.list_records(tenant_id="tenant-a")
    assert len(rows) == 1
    assert rows[0]["status"] == "approved"
    assert rows[0]["created_utc"] == first.created_utc  # preserved across upserts


def test_validation(repo):
    with pytest.raises(ValueError):
        repo.upsert(tenant_id="tenant-a", user_id="bob", permit={"status": "x"})  # no id
    with pytest.raises(ValueError):
        repo.upsert(tenant_id="", user_id="bob", permit={"id": "p1"})


def test_tenant_isolation_and_rls(repo, app_dsn):
    repo.upsert(tenant_id="tenant-a", user_id="bob", permit={"id": "p1"})
    repo.upsert(tenant_id="tenant-b", user_id="ann", permit={"id": "p2"})
    assert repo.get(tenant_id="tenant-b", permit_id="p1") is None
    assert {p["id"] for p in repo.list_records(tenant_id="tenant-a")} == {"p1"}

    import psycopg

    from app.db import pg

    with psycopg.connect(pg.normalize_dsn(app_dsn), autocommit=True) as conn:
        pg.set_tenant(conn, "tenant-a")
        seen = {r[0] for r in conn.execute("SELECT tenant_id FROM permits").fetchall()}
    assert seen == {"tenant-a"}
