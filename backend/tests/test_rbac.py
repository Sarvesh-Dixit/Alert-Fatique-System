"""RBAC unit + enforcement tests."""
from app.core.rbac import Permission, Role, has_permission, normalize_role
from tests._helpers import add_member, login
from tests.conftest import register_org


def test_role_normalization_and_legacy_mapping():
    assert normalize_role("owner") == Role.OWNER
    assert normalize_role("member") == Role.ENGINEER
    assert normalize_role("ADMIN") == Role.ADMIN
    assert normalize_role(None) == Role.VIEWER


def test_permission_matrix():
    assert has_permission("OWNER", Permission.MANAGE_MEMBERS)
    assert not has_permission("ADMIN", Permission.MANAGE_MEMBERS)
    assert has_permission("ADMIN", Permission.MANAGE_DEVICES)
    assert not has_permission("ENGINEER", Permission.MANAGE_DEVICES)
    assert has_permission("ENGINEER", Permission.MANAGE_INCIDENTS)
    assert has_permission("VIEWER", Permission.VIEW)
    assert not has_permission("VIEWER", Permission.MANAGE_INCIDENTS)


def test_viewer_cannot_manage_devices(client):
    token, org_id = register_org(client)
    add_member(org_id, "viewer@ex.com", "viewer")
    vtoken = login(client, "viewer@ex.com")

    resp = client.post(
        f"/api/v1/organizations/{org_id}/devices",
        json={"hostname": "srv-1", "operating_system": "linux"},
        headers={"Authorization": f"Bearer {vtoken}"},
    )
    assert resp.status_code == 403


def test_engineer_cannot_manage_integrations(client):
    token, org_id = register_org(client)
    add_member(org_id, "eng@ex.com", "engineer")
    etoken = login(client, "eng@ex.com")

    resp = client.put(
        f"/api/v1/organizations/{org_id}/integrations",
        json={"type": "slack", "config": {"webhook_url": "https://hooks.slack.com/x"}, "min_severity": "HIGH"},
        headers={"Authorization": f"Bearer {etoken}"},
    )
    assert resp.status_code == 403


def test_owner_can_change_member_role(client):
    token, org_id = register_org(client)
    uid = add_member(org_id, "eng@ex.com", "engineer")
    h = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        f"/api/v1/organizations/{org_id}/members/{uid}/role?role=ADMIN", headers=h
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "ADMIN"


def test_admin_cannot_change_roles(client):
    token, org_id = register_org(client)
    add_member(org_id, "admin@ex.com", "admin")
    uid = add_member(org_id, "eng@ex.com", "engineer")
    atoken = login(client, "admin@ex.com")

    resp = client.post(
        f"/api/v1/organizations/{org_id}/members/{uid}/role?role=VIEWER",
        headers={"Authorization": f"Bearer {atoken}"},
    )
    assert resp.status_code == 403
