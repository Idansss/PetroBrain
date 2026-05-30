"""
Postgres backend integration tests for the documents repository (Tier 2, 005).

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
    from app.db.document_repository import PostgresDocumentRepository

    with pg.connect(pg.normalize_dsn(ADMIN_DSN)) as conn:
        conn.execute("TRUNCATE documents")
    return PostgresDocumentRepository(app_dsn)


def _req(**kw):
    base = {
        "document_id": "SOP-1", "title": "Kick SOP", "revision": "B",
        "jurisdiction": "NUPRC", "asset": "asset-a", "effective_date": "2026-01-01",
        "document_type": "sop", "filename": "kick.pdf",
    }
    base.update(kw)
    return base


def test_save_returns_full_record(repo):
    chunks = [{"clause": "1.0", "text": "..."}, {"clause": "2.0", "text": "..."}]
    rec = repo.save(tenant_id="tenant-a", user_id="u1", request=_req(), chunks=chunks)
    assert rec.tenant_id == "tenant-a"
    assert rec.document_id == "SOP-1"
    assert rec.chunk_count == 2
    assert rec.chunks == chunks
    assert isinstance(rec.created_utc, str) and rec.created_utc
    assert rec.ingest_id


def test_get_returns_full_record_with_chunks(repo):
    chunks = [{"clause": "1.0", "text": "x"}]
    rec = repo.save(tenant_id="tenant-a", user_id="u1", request=_req(), chunks=chunks)
    got = repo.get(tenant_id="tenant-a", ingest_id=rec.ingest_id)
    assert got["chunks"] == chunks
    assert got["asset"] == "asset-a"
    assert got["effective_date"] == "2026-01-01"


def test_list_records_returns_summaries_without_chunks(repo):
    repo.save(tenant_id="tenant-a", user_id="u1", request=_req(document_id="SOP-1"), chunks=[{"a": 1}])
    repo.save(tenant_id="tenant-a", user_id="u1", request=_req(document_id="SOP-2"), chunks=[])
    rows = repo.list_records(tenant_id="tenant-a")
    assert {r["document_id"] for r in rows} == {"SOP-1", "SOP-2"}
    assert all("chunks" not in r for r in rows)
    assert all("chunk_count" in r for r in rows)


def test_optional_fields_default(repo):
    rec = repo.save(tenant_id="tenant-a", user_id="u1",
                    request={"document_id": "D", "title": "T", "filename": "f.pdf"},
                    chunks=[])
    assert rec.revision == ""
    assert rec.jurisdiction == ""
    assert rec.asset is None
    assert rec.effective_date is None
    assert rec.document_type == "sop"


def test_tenant_isolation_and_rls(repo, app_dsn):
    a = repo.save(tenant_id="tenant-a", user_id="u1", request=_req(), chunks=[])
    repo.save(tenant_id="tenant-b", user_id="u2", request=_req(), chunks=[])
    assert repo.get(tenant_id="tenant-b", ingest_id=a.ingest_id) is None
    assert {r["document_id"] for r in repo.list_records(tenant_id="tenant-a")}  # only a's
    assert len(repo.list_records(tenant_id="tenant-a")) == 1

    import psycopg

    from app.db import pg

    with psycopg.connect(pg.normalize_dsn(app_dsn), autocommit=True) as conn:
        pg.set_tenant(conn, "tenant-a")
        seen = {r[0] for r in conn.execute("SELECT tenant_id FROM documents").fetchall()}
    assert seen == {"tenant-a"}
