from tests.conftest import create_app_with_key, register_org


def test_create_key_returns_plaintext_once(client):
    token, org_id = register_org(client)
    headers = {"Authorization": f"Bearer {token}"}
    app_id, _ = create_app_with_key(client, token, org_id)

    # Listing keys must NEVER expose the plaintext, only a masked value.
    listed = client.get(f"/api/v1/applications/{app_id}/api-keys", headers=headers).json()
    assert len(listed) == 1
    assert "api_key" not in listed[0]
    assert listed[0]["masked_key"].startswith("th_")
    assert "•" in listed[0]["masked_key"]


def test_revoke_key(client):
    token, org_id = register_org(client)
    headers = {"Authorization": f"Bearer {token}"}
    app_id, _ = create_app_with_key(client, token, org_id)
    key_id = client.get(f"/api/v1/applications/{app_id}/api-keys", headers=headers).json()[0]["id"]

    resp = client.post(
        f"/api/v1/applications/{app_id}/api-keys/{key_id}/revoke", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_revoked_key_cannot_ingest(client):
    token, org_id = register_org(client)
    headers = {"Authorization": f"Bearer {token}"}
    app_id, api_key = create_app_with_key(client, token, org_id)
    key_id = client.get(f"/api/v1/applications/{app_id}/api-keys", headers=headers).json()[0]["id"]

    client.post(f"/api/v1/applications/{app_id}/api-keys/{key_id}/revoke", headers=headers)

    resp = client.post(
        "/api/v1/telemetry",
        json={"message": "hello", "severity": "INFO"},
        headers={"X-API-Key": api_key},
    )
    assert resp.status_code == 403


def test_rotate_key(client):
    token, org_id = register_org(client)
    headers = {"Authorization": f"Bearer {token}"}
    app_id, api_key = create_app_with_key(client, token, org_id)
    key_id = client.get(f"/api/v1/applications/{app_id}/api-keys", headers=headers).json()[0]["id"]

    resp = client.post(
        f"/api/v1/applications/{app_id}/api-keys/{key_id}/rotate", headers=headers
    )
    assert resp.status_code == 200
    new_key = resp.json()["api_key"]
    assert new_key != api_key

    # Old key rejected, new key accepted.
    old = client.post(
        "/api/v1/telemetry", json={"message": "x"}, headers={"X-API-Key": api_key}
    )
    assert old.status_code == 403
    new = client.post(
        "/api/v1/telemetry", json={"message": "x"}, headers={"X-API-Key": new_key}
    )
    assert new.status_code == 202
