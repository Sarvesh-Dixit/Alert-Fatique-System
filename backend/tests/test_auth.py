from tests.conftest import register_org


def test_register_and_login(client):
    token, org_id = register_org(client)
    assert token
    assert org_id.startswith("org_")


def test_duplicate_email_rejected(client):
    register_org(client, email="dup@example.com")
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dup@example.com",
            "password": "supersecret",
            "full_name": "Other",
            "organization_name": "Other Org",
        },
    )
    assert resp.status_code == 409


def test_login_wrong_password(client):
    register_org(client, email="a@example.com")
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "a@example.com", "password": "wrong-password"},
    )
    assert resp.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_short_password_rejected(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "x@example.com",
            "password": "short",
            "full_name": "X",
            "organization_name": "X Org",
        },
    )
    assert resp.status_code == 422


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_guest_login(client):
    resp = client.post("/api/v1/auth/guest")
    assert resp.status_code == 200
    assert "access_token" in resp.json()
