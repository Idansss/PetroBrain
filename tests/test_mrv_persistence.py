"""MRV persistence tests."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.mrv_repository import LocalJsonMRVRepository


def sample_request():
    return {
        "facility_id": "FAC-1",
        "period": "2026-Q3",
        "operator": "Demo E&P",
        "asset": "OML-DEMO",
        "gwp_set": "AR6",
        "target_tier": "Tier 3",
        "sources": [],
    }


def sample_response(status="ready_for_target_tier"):
    return {
        "inventory": {
            "facility_id": "FAC-1",
            "period": "2026-Q3",
            "totals": {"co2e_tonnes": 10.0},
            "tier_summary": {"Tier 3": 1},
            "lines": [],
        },
        "ghgemp_report": {"audit_sha256": "abc123"},
        "mrv_readiness": {
            "status": status,
            "tier_readiness_pct": 100.0,
            "gap_count": 0,
            "total_co2e_tonnes": 10.0,
            "audit_sha256": "abc123",
        },
    }


def test_local_json_mrv_repository_save_list_get_by_tenant(tmp_path):
    repo = LocalJsonMRVRepository(tmp_path / "mrv.jsonl")

    record_a = repo.save(
        tenant_id="tenant-a",
        user_id="u1",
        request=sample_request(),
        response=sample_response(),
    )
    repo.save(
        tenant_id="tenant-b",
        user_id="u2",
        request=sample_request(),
        response=sample_response("action_required"),
    )

    tenant_a_rows = repo.list_records(tenant_id="tenant-a")
    assert len(tenant_a_rows) == 1
    assert tenant_a_rows[0]["inventory_id"] == record_a.inventory_id
    assert tenant_a_rows[0]["status"] == "ready_for_target_tier"

    detail = repo.get(tenant_id="tenant-a", inventory_id=record_a.inventory_id)
    assert detail is not None
    assert detail["tenant_id"] == "tenant-a"
    assert detail["response"]["mrv_readiness"]["audit_sha256"] == "abc123"

    assert repo.get(tenant_id="tenant-b", inventory_id=record_a.inventory_id) is None
