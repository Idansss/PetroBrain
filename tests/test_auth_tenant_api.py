"""Auth and tenant isolation tests at the API boundary."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from app.api import deps, routes_emissions
from app.db.mrv_repository import LocalJsonMRVRepository
from app.main import app
from tests.auth_helpers import auth_headers, jwt_settings


client = TestClient(app)


@pytest.fixture(autouse=True)
def use_jwt_settings(monkeypatch):
    monkeypatch.setattr(deps, "get_settings", jwt_settings)


def tenant_a_headers():
    return auth_headers(tenant_id="tenant-a", user_id="alice", allowed_assets=["Asset-A"])


def tenant_b_headers():
    return auth_headers(tenant_id="tenant-b", user_id="bob", allowed_assets=["Asset-B"])


def emissions_payload(asset="Asset-A"):
    return {
        "facility_id": "FAC-1",
        "period": "2026-Q3",
        "operator": "Demo E&P",
        "asset": asset,
        "gwp_set": "AR6",
        "target_tier": "Tier 3",
        "sources": [
            {
                "source_id": "FL-1",
                "source_type": "flaring",
                "params": {
                    "gas_volume_scf": 1_000_000,
                    "composition": {"CH4": 1.0},
                    "combustion_efficiency": 0.98,
                    "measured": True,
                },
            }
        ],
    }


def test_invalid_bearer_token_is_rejected():
    r = client.post("/chat", headers={"Authorization": "Bearer not-configured"}, json={"message": "write me a poem"})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid credentials"


def test_non_bearer_auth_is_rejected():
    r = client.post("/chat", headers={"Authorization": "Basic abc"}, json={"message": "write me a poem"})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid credentials"


def test_asset_scope_blocks_mrv_inventory(monkeypatch, tmp_path):
    monkeypatch.setattr(routes_emissions, "mrv_repository", LocalJsonMRVRepository(tmp_path / "mrv.jsonl"))

    r = client.post(
        "/emissions/inventory",
        headers=tenant_a_headers(),
        json=emissions_payload(asset="Asset-B"),
    )

    assert r.status_code == 403
    assert r.json()["detail"] == "asset not allowed for principal"


def test_mrv_records_are_tenant_scoped(monkeypatch, tmp_path):
    monkeypatch.setattr(routes_emissions, "mrv_repository", LocalJsonMRVRepository(tmp_path / "mrv.jsonl"))

    created = client.post(
        "/emissions/inventory",
        headers=tenant_a_headers(),
        json=emissions_payload(asset="Asset-A"),
    )
    assert created.status_code == 200
    inventory_id = created.json()["inventory_id"]

    own_list = client.get("/emissions/inventories", headers=tenant_a_headers())
    assert own_list.status_code == 200
    assert len(own_list.json()["inventories"]) == 1

    other_list = client.get("/emissions/inventories", headers=tenant_b_headers())
    assert other_list.status_code == 200
    assert other_list.json()["inventories"] == []

    other_detail = client.get(f"/emissions/inventories/{inventory_id}", headers=tenant_b_headers())
    assert other_detail.status_code == 404

    own_detail = client.get(f"/emissions/inventories/{inventory_id}", headers=tenant_a_headers())
    assert own_detail.status_code == 200
    assert own_detail.json()["tenant_id"] == "tenant-a"
