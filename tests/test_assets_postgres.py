"""
Postgres backend integration tests for the assets repository (Tier 2, 003).

Mirrors the LocalJson behaviours in tests/test_assets.py against real Postgres
(recursive-CTE traversal + RLS). Runs only when ``PB_TEST_DATABASE_URL`` is set.
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
    from app.db.assets_repository import PostgresAssetsRepository

    with pg.connect(pg.normalize_dsn(ADMIN_DSN)) as conn:
        conn.execute("TRUNCATE assets, asset_relationships CASCADE")
    return PostgresAssetsRepository(app_dsn)


def _seed(repo, tenant="tenant-a", s="-a"):
    field = repo.create(tenant_id=tenant, type="field", name="Niger-Delta", asset_id=f"field{s}")
    block = repo.create(tenant_id=tenant, type="block", name="OML-99",
                        parent_id=field.id, asset_id=f"block{s}")
    train = repo.create(tenant_id=tenant, type="train", name="Train A",
                        parent_id=block.id, asset_id=f"train{s}")
    eq = repo.create(tenant_id=tenant, type="equipment", name="Compressor K-101",
                     parent_id=train.id, asset_id=f"eq{s}")
    sibling = repo.create(tenant_id=tenant, type="equipment", name="Compressor K-102",
                          parent_id=train.id, asset_id=f"eq2{s}")
    return field, block, train, eq, sibling


def test_create_and_descendants(repo):
    field, block, train, eq, sibling = _seed(repo)
    desc = repo.descendants(tenant_id="tenant-a", asset_id=field.id)
    assert {a.id for a in desc} == {block.id, train.id, eq.id, sibling.id}
    assert {a.id for a in repo.descendants(tenant_id="tenant-a", asset_id=train.id)} == {eq.id, sibling.id}


def test_path_to_root(repo):
    field, block, train, eq, _ = _seed(repo)
    path = repo.path_to_root(tenant_id="tenant-a", asset_id=eq.id)
    assert [a.id for a in path] == [field.id, block.id, train.id, eq.id]
    assert [a.type for a in path] == ["field", "block", "train", "equipment"]
    assert repo.path_to_root(tenant_id="tenant-a", asset_id="missing") == []


def test_rejects_unknown_parent_and_cycles(repo):
    _seed(repo)
    with pytest.raises(ValueError, match="parent"):
        repo.create(tenant_id="tenant-a", type="equipment", name="orphan", parent_id="missing")
    with pytest.raises(ValueError):
        repo.update(tenant_id="tenant-a", asset_id="eq-a", parent_id="eq-a")
    with pytest.raises(ValueError, match="cycle"):
        repo.update(tenant_id="tenant-a", asset_id="field-a", parent_id="eq-a")


def test_get_update_and_clear_parent(repo):
    _seed(repo)
    eq = repo.get(tenant_id="tenant-a", asset_id="eq-a")
    assert eq.name == "Compressor K-101"
    updated = repo.update(tenant_id="tenant-a", asset_id="eq-a", name="K-101b",
                          attributes={"tag": "x"})
    assert updated.name == "K-101b" and updated.attributes == {"tag": "x"}
    cleared = repo.update(tenant_id="tenant-a", asset_id="eq-a", clear_parent=True)
    assert cleared.parent_id is None
    with pytest.raises(KeyError):
        repo.update(tenant_id="tenant-a", asset_id="nope", name="x")


def test_list_filters_and_ordering(repo):
    _seed(repo)
    roots = repo.list_records(tenant_id="tenant-a", roots_only=True)
    assert [a.id for a in roots] == ["field-a"]
    children = repo.list_records(tenant_id="tenant-a", parent_id="train-a")
    assert [a.name for a in children] == ["Compressor K-101", "Compressor K-102"]  # type,name order
    eqs = repo.list_records(tenant_id="tenant-a", type="equipment")
    assert {a.id for a in eqs} == {"eq-a", "eq2-a"}


def test_requires_tenant(repo):
    with pytest.raises(ValueError):
        repo.list_records(tenant_id="")
    with pytest.raises(ValueError):
        repo.descendants(tenant_id="", asset_id="x")
    with pytest.raises(ValueError):
        repo.path_to_root(tenant_id="", asset_id="x")


def test_relationships(repo):
    _, _, _, eq, sibling = _seed(repo)
    edge = repo.create_relationship(tenant_id="tenant-a", src_id=eq.id, dst_id=sibling.id,
                                    relation="feeds")
    assert edge.id >= 1
    edges = repo.list_relationships(tenant_id="tenant-a", asset_id=eq.id)
    assert len(edges) == 1 and edges[0].relation == "feeds"
    with pytest.raises(ValueError, match="duplicate"):
        repo.create_relationship(tenant_id="tenant-a", src_id=eq.id, dst_id=sibling.id,
                                 relation="feeds")
    with pytest.raises(ValueError):
        repo.create_relationship(tenant_id="tenant-a", src_id=eq.id, dst_id=eq.id, relation="x")
    with pytest.raises(ValueError, match="not found"):
        repo.create_relationship(tenant_id="tenant-a", src_id=eq.id, dst_id="ghost", relation="x")


def test_tenant_isolation_and_rls(repo, app_dsn):
    _seed(repo, tenant="tenant-a", s="-a")
    _seed(repo, tenant="tenant-b", s="-b")
    # cross-tenant get/descendants return nothing for the other tenant's ids
    assert repo.get(tenant_id="tenant-b", asset_id="eq-a") is None
    assert repo.path_to_root(tenant_id="tenant-b", asset_id="eq-a") == []
    assert {a.id for a in repo.list_records(tenant_id="tenant-a")} == {
        "field-a", "block-a", "train-a", "eq-a", "eq2-a"
    }
    # RLS backstop: a raw unfiltered SELECT only sees the GUC tenant
    import psycopg

    from app.db import pg

    with psycopg.connect(pg.normalize_dsn(app_dsn), autocommit=True) as conn:
        pg.set_tenant(conn, "tenant-a")
        seen = {r[0] for r in conn.execute("SELECT tenant_id FROM assets").fetchall()}
    assert seen == {"tenant-a"}
