from app.core.redaction import REDACTED, redact_mapping, redact_text


def test_redact_inline_text():
    assert redact_text("login with password=abc123 now") == f"login with password={REDACTED} now"


def test_redact_colon_form():
    assert "token" in redact_text("token: xyz")
    assert REDACTED in redact_text("token: xyz")


def test_redact_mapping_keys():
    data = {"password": "hunter2", "user": "bob", "nested": {"api_key": "k"}}
    out = redact_mapping(data)
    assert out["password"] == REDACTED
    assert out["user"] == "bob"
    assert out["nested"]["api_key"] == REDACTED


def test_redact_mapping_list_and_case_insensitive():
    data = {"Authorization": "Bearer abc", "items": ["password=secret"]}
    out = redact_mapping(data)
    assert out["Authorization"] == REDACTED
    assert REDACTED in out["items"][0]
