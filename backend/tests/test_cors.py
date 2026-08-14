"""Tests for CORS preflight configuration and origin validation."""

def test_cors_preflight_valid_origins(client):
    valid_origins = [
        "https://alert-fatique-system.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://my-preview-app.vercel.app",
        "https://sub-domain.vercel.app",
    ]
    for origin in valid_origins:
        headers = {
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, x-api-key",
        }
        response = client.options("/api/v1/telemetry", headers=headers)
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin
        assert response.headers.get("access-control-allow-credentials") == "true"
        assert "POST" in response.headers.get("access-control-allow-methods", "")

def test_cors_preflight_invalid_origin(client):
    headers = {
        "Origin": "https://invalid-domain.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    response = client.options("/api/v1/telemetry", headers=headers)
    # When CORS validation fails, the response will either not have Access-Control headers
    # or will be rejected.
    assert "access-control-allow-origin" not in response.headers
