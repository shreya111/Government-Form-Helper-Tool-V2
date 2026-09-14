import io
import os
import zipfile

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formwise-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --- /api/form-help ---
def test_form_help_with_new_optional_fields():
    payload = {
        "field_label": "Are you related to a government servant?",
        "field_type": "radio",
        "field_options": "Yes, No",
        "section_context": "Family Details",
        "help_text": "",
    }
    r = requests.post(f"{API}/form-help", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "advice" in data
    assert "warning" in data
    assert isinstance(data.get("advice"), str) and len(data["advice"]) > 0


def test_form_help_backward_compat_no_optional():
    payload = {
        "field_label": "Given Name (First & Middle Name)",
        "field_type": "input",
        "form_context": "Indian Passport Application Form",
    }
    r = requests.post(f"{API}/form-help", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "advice" in data
    assert data.get("field_label")


# --- /api/chat ---
def test_chat_endpoint():
    payload = {
        "message": "What documents do I need for passport application?",
        "page_context": {
            "page_title": "Passport Seva",
            "page_url": "https://passportindia.gov.in/",
            "page_text": "Family Details section",
            "form_data": {},
        },
    }
    r = requests.post(f"{API}/chat", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    # Response should contain a string reply (schema unknown, test loosely)
    assert isinstance(data, dict)
    text_val = data.get("response") or data.get("reply") or data.get("message") or ""
    assert isinstance(text_val, str) and len(text_val) > 0, f"unexpected chat response: {data}"


# --- /api/extension/download ---
def test_extension_download_zip_contents():
    r = requests.get(f"{API}/extension/download", timeout=30)
    assert r.status_code == 200
    ctype = r.headers.get("content-type", "")
    assert "application/zip" in ctype, f"content-type: {ctype}"
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    required = [
        "extension/panel/panel.js",
        "extension/panel/index.html",
        "extension/content.js",
        "extension/config.js",
        "extension/manifest.json",
    ]
    for req in required:
        assert any(n.endswith(req) or n == req for n in names), f"missing {req} in zip. contents: {names[:20]}"
    # manifest version 2.0.0
    manifest_name = next(n for n in names if n.endswith("manifest.json"))
    with z.open(manifest_name) as f:
        import json
        mf = json.load(f)
    assert mf.get("version") == "2.0.0", f"manifest version: {mf.get('version')}"


# --- /api/status removed ---
def test_status_endpoint_removed():
    r = requests.get(f"{API}/status", timeout=10)
    assert r.status_code == 404, f"expected 404, got {r.status_code}"


# --- /api/form-help/history still works ---
def test_form_help_history():
    r = requests.get(f"{API}/form-help/history", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
