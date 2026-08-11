from tests.conftest import register_org


def test_device_registration_and_enroll(client):
    token, org_id = register_org(client)
    headers = {"Authorization": f"Bearer {token}"}

    reg = client.post(
        f"/api/v1/organizations/{org_id}/devices",
        json={"hostname": "web-01", "operating_system": "linux", "agent_version": "0.1.0"},
        headers=headers,
    )
    assert reg.status_code == 201
    body = reg.json()
    assert body["status"] == "pending"
    token_value = body["enrollment_token"]
    device_id = body["id"]

    # Enroll with the short-lived token.
    enroll = client.post(
        "/api/v1/devices/enroll",
        json={"device_id": device_id, "enrollment_token": token_value},
    )
    assert enroll.status_code == 200
    assert enroll.json()["status"] == "enrolled"

    # Token is single-use — a second attempt must not succeed.
    again = client.post(
        "/api/v1/devices/enroll",
        json={"device_id": device_id, "enrollment_token": token_value},
    )
    assert again.status_code in (401, 404)


def test_device_heartbeat(client):
    token, org_id = register_org(client)
    headers = {"Authorization": f"Bearer {token}"}
    reg = client.post(
        f"/api/v1/organizations/{org_id}/devices",
        json={"hostname": "web-02"},
        headers=headers,
    ).json()

    hb = client.post(
        "/api/v1/devices/heartbeat",
        json={"device_id": reg["id"], "agent_version": "0.2.0"},
    )
    assert hb.status_code == 200
    assert hb.json()["last_heartbeat_at"] is not None
