"""
Postgres backend integration tests for the audit_events repository (Tier 2 #3).

Runs only when ``PB_TEST_DATABASE_URL`` points at a reachable Postgres (CI's
``postgres`` service); otherwise skipped, so the default local_json run is
unaffected. Follows the pattern established in test_users_postgres.py: the
repository connects as a NOSUPERUSER role so RLS is actually exercised.
"""
import os
import sys
from datetime import datetime, timedelta, timezone
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
        # BIGSERIAL columns (e.g. audit_events.id) need sequence USAGE to INSERT.
        conn.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}")
    return _app_dsn(ADMIN_DSN)


@pytest.fixture
def repo(app_dsn):
    from app.db import pg
    from app.db.audit_events_repository import PostgresAuditEventsRepository

    with pg.connect(pg.normalize_dsn(ADMIN_DSN)) as conn:
        conn.execute("TRUNCATE audit_events")
    return PostgresAuditEventsRepository(app_dsn)


def _append(repo, *, tenant_id="tenant-a", user_id="u1", role="engineer",
            action="chat", module="general", request_hash="a" * 64,
            response_hash="b" * 64, **kw):
    return repo.append(tenant_id=tenant_id, user_id=user_id, role=role, action=action,
                       module=module, request_hash=request_hash,
                       response_hash=response_hash, **kw)


def test_append_returns_row_with_int_id_and_iso_ts(repo):
    row = _append(repo, flags=["live_event"], usage={"input_tokens": 10},
                  retrieved_clauses=["7.4"])
    assert isinstance(row.id, int)
    assert isinstance(row.ts, str) and row.ts  # serialized to ISO
    assert row.tenant_id == "tenant-a"
    assert row.flags == ["live_event"]
    assert row.usage == {"input_tokens": 10}
    assert row.retrieved_clauses == ["7.4"]


def test_query_is_tenant_scoped_and_ordered_desc(repo):
    base = datetime(2026, 5, 1, tzinfo=timezone.utc)
    _append(repo, tenant_id="tenant-a", ts=base, action="chat")
    _append(repo, tenant_id="tenant-a", ts=base + timedelta(hours=1), action="tool:x")
    _append(repo, tenant_id="tenant-b", ts=base + timedelta(hours=2))
    rows = repo.query(tenant_id="tenant-a")
    assert [r["action"] for r in rows] == ["tool:x", "chat"]  # newest first
    assert all(r["tenant_id"] == "tenant-a" for r in rows)


def test_query_filters_and_pagination(repo):
    base = datetime(2026, 5, 1, tzinfo=timezone.utc)
    for i in range(5):
        _append(repo, ts=base + timedelta(minutes=i), user_id=f"u{i}", module="well_control")
    _append(repo, ts=base + timedelta(hours=1), user_id="u9", module="emissions_mrv")
    assert {r["module"] for r in repo.query(tenant_id="tenant-a", module="well_control")} == {"well_control"}
    assert [r["user_id"] for r in repo.query(tenant_id="tenant-a", user_id="u2")] == ["u2"]
    page1 = repo.query(tenant_id="tenant-a", limit=2, offset=0)
    page2 = repo.query(tenant_id="tenant-a", limit=2, offset=2)
    assert len(page1) == 2 and len(page2) == 2
    assert {r["id"] for r in page1}.isdisjoint({r["id"] for r in page2})
    # time window
    windowed = repo.query(tenant_id="tenant-a", from_ts=base + timedelta(minutes=2),
                          to_ts=base + timedelta(minutes=4))
    assert {r["user_id"] for r in windowed} == {"u2", "u3", "u4"}


def test_count_is_tenant_scoped(repo):
    _append(repo, tenant_id="tenant-a")
    _append(repo, tenant_id="tenant-a")
    _append(repo, tenant_id="tenant-b")
    assert repo.count(tenant_id="tenant-a") == 2
    assert repo.count(tenant_id="tenant-b") == 1


def test_platform_admin_override_reads_target_tenant_only(repo):
    _append(repo, tenant_id="tenant-a", user_id="alice")
    _append(repo, tenant_id="tenant-b", user_id="bob")
    # A platform admin "override" is just querying with the target tenant_id;
    # the RLS policy has no '*' branch, so each query sees only its tenant.
    assert {r["user_id"] for r in repo.query(tenant_id="tenant-a")} == {"alice"}
    assert {r["user_id"] for r in repo.query(tenant_id="tenant-b")} == {"bob"}


def test_validation_errors(repo):
    with pytest.raises(ValueError):
        _append(repo, request_hash="")
    with pytest.raises(ValueError):
        repo.query(tenant_id="tenant-a", limit=0)
    with pytest.raises(ValueError):
        repo.query(tenant_id="tenant-a", limit=10, offset=-1)
    with pytest.raises(ValueError):
        repo.query(tenant_id="")


def test_rls_policy_blocks_cross_tenant_reads(repo, app_dsn):
    import psycopg

    from app.db import pg

    _append(repo, tenant_id="tenant-a")
    _append(repo, tenant_id="tenant-b")
    with psycopg.connect(pg.normalize_dsn(app_dsn), autocommit=True) as conn:
        pg.set_tenant(conn, "tenant-a")
        seen = {r[0] for r in conn.execute("SELECT tenant_id FROM audit_events").fetchall()}
    assert seen == {"tenant-a"}
