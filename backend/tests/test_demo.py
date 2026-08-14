from tests.conftest import register_org


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_loghub_hdfs_outage_compression(client):
    """Verify that running loghub-hdfs-outage scenario with 1,000 logs compresses into < 5 actionable incidents."""
    token, org_id = register_org(client)
    h = _headers(token)

    # Simulate loghub-hdfs-outage outage scenario with count=1000
    resp = client.post(
        f"/api/v1/organizations/{org_id}/demo/simulate/loghub-hdfs-outage?count=1000&apps=3&noise_factor=1&sync=true",
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["total_raw_events"] == 1000
    assert body["resulting_incidents_created"] < 5
    assert body["noise_reduction_ratio"] is not None
