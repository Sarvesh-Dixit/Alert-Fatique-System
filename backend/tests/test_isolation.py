from tests.conftest import create_app_with_key, register_org


def test_org_cannot_see_other_orgs_application(client):
    token_a, org_a = register_org(client, email="a@example.com", org="OrgA")
    app_a, _ = create_app_with_key(client, token_a, org_a)

    token_b, org_b = register_org(client, email="b@example.com", org="OrgB")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Org B cannot read Org A's application.
    resp = client.get(f"/api/v1/applications/{app_a}", headers=headers_b)
    assert resp.status_code == 404

    # Org B cannot list applications under Org A.
    resp = client.get(f"/api/v1/organizations/{org_a}/applications", headers=headers_b)
    assert resp.status_code == 404


def test_org_cannot_query_other_orgs_telemetry(client):
    token_a, org_a = register_org(client, email="a@example.com", org="OrgA")
    token_b, org_b = register_org(client, email="b@example.com", org="OrgB")

    resp = client.get(
        f"/api/v1/organizations/{org_a}/telemetry",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404
