"""
Postgres integration tests for Research Mode persistence and tenant RLS.

Runs only when ``PB_TEST_DATABASE_URL`` is set; skipped otherwise.
"""
import os
from urllib.parse import urlsplit, urlunsplit

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
            f"THEN CREATE ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}' NOSUPERUSER; "
            "END IF; END $$;"
        )
        conn.execute(
            f"ALTER ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}' NOSUPERUSER"
        )
        conn.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
        conn.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public "
            f"TO {APP_ROLE}"
        )
    return _app_dsn(ADMIN_DSN)


@pytest.fixture
def repo(app_dsn):
    from app.db import pg
    from app.db.research_repository import PostgresResearchRepository

    with pg.connect(pg.normalize_dsn(ADMIN_DSN)) as conn:
        conn.execute("TRUNCATE research_runs")
        conn.execute(
            "INSERT INTO tenants (id, name, status) VALUES "
            "('tenant-a', 'Tenant A', 'active'), "
            "('tenant-b', 'Tenant B', 'active') "
            "ON CONFLICT (id) DO NOTHING"
        )
    return PostgresResearchRepository(app_dsn)


def _create(repo, tenant_id: str, user_id: str):
    return repo.create(
        tenant_id=tenant_id,
        user_id=user_id,
        role="engineer",
        query="Assess methane measurement readiness",
        config={"maximum_sources": 8},
        plan=[
            {
                "id": "step-1",
                "title": "Check evidence",
                "question": "Find governed evidence",
                "source_types": ["internal_document"],
                "status": "pending",
            }
        ],
    )


def test_create_update_list_and_tenant_isolation(repo, app_dsn):
    tenant_a = _create(repo, "tenant-a", "user-a")
    _create(repo, "tenant-b", "user-b")

    updated = repo.update(
        tenant_id="tenant-a",
        research_id=tenant_a.id,
        patch={"status": "approved", "flags": ["reviewed"]},
    )
    repo.append_event(
        tenant_id="tenant-a",
        research_id=tenant_a.id,
        event="plan_approved",
        data={"status": "approved"},
    )

    assert updated["status"] == "approved"
    assert repo.get(tenant_id="tenant-b", research_id=tenant_a.id) is None
    assert len(repo.list(tenant_id="tenant-a")) == 1
    assert repo.get(tenant_id="tenant-a", research_id=tenant_a.id)["events"][0][
        "event"
    ] == "plan_approved"

    import psycopg

    from app.db import pg

    with psycopg.connect(pg.normalize_dsn(app_dsn), autocommit=True) as conn:
        pg.set_tenant(conn, "tenant-a")
        seen = {
            row[0]
            for row in conn.execute("SELECT tenant_id FROM research_runs").fetchall()
        }
    assert seen == {"tenant-a"}
