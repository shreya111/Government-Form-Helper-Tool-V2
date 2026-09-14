"""Document Intelligence + Autofill API tests. Uses seeded sessions for user A and B.

Seed users/sessions are read from env vars TEST_TOKEN_A / TEST_TOKEN_B; if not set the
fixture will insert new ones directly into Mongo.
"""
import io
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from PIL import Image
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formwise-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# --- fixtures ---
@pytest.fixture(scope="session")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _seed_user(db, tag: str) -> tuple[str, str]:
    uid = f"user_test{tag}_{uuid.uuid4().hex[:8]}"
    tok = f"test_session_{tag}_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    db.users.insert_one({
        "user_id": uid, "email": f"test.{tag.lower()}.{uid}@example.com",
        "name": f"Test {tag}", "picture": "", "created_at": now.isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok,
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat(),
    })
    return uid, tok


@pytest.fixture(scope="session")
def user_a(mongo_db):
    uid, tok = _seed_user(mongo_db, "A")
    yield {"uid": uid, "token": tok}
    mongo_db.user_sessions.delete_many({"user_id": uid})
    mongo_db.users.delete_many({"user_id": uid})
    mongo_db.documents.delete_many({"user_id": uid})


@pytest.fixture(scope="session")
def user_b(mongo_db):
    uid, tok = _seed_user(mongo_db, "B")
    yield {"uid": uid, "token": tok}
    mongo_db.user_sessions.delete_many({"user_id": uid})
    mongo_db.users.delete_many({"user_id": uid})
    mongo_db.documents.delete_many({"user_id": uid})


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- /api/auth/me ---
def test_me_no_token():
    r = requests.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


def test_me_invalid_token():
    r = requests.get(f"{API}/auth/me", headers=_hdr("nope-not-a-real-token"), timeout=15)
    assert r.status_code == 401


def test_me_valid_token(user_a):
    r = requests.get(f"{API}/auth/me", headers=_hdr(user_a["token"]), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user_id"] == user_a["uid"]
    assert "email" in data


def test_logout_clears_session(mongo_db):
    # seed a throwaway session
    uid, tok = _seed_user(mongo_db, "L")
    try:
        # bearer-based logout does not carry the cookie, but endpoint must return ok
        r = requests.post(f"{API}/auth/logout", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        # emulate cookie logout to actually delete session record
        r = requests.post(f"{API}/auth/logout", cookies={"session_token": tok}, timeout=15)
        assert r.status_code == 200
        # session must be gone
        assert mongo_db.user_sessions.find_one({"session_token": tok}) is None
        # subsequent /me must 401
        r = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=15)
        assert r.status_code == 401
    finally:
        mongo_db.user_sessions.delete_many({"user_id": uid})
        mongo_db.users.delete_many({"user_id": uid})


# --- upload validation ---
def _png_bytes(w=32, h=32) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (200, 210, 220)).save(buf, format="PNG")
    return buf.getvalue()


def test_upload_requires_auth():
    files = {"file": ("x.png", _png_bytes(), "image/png")}
    r = requests.post(f"{API}/documents/upload", files=files, timeout=30)
    assert r.status_code == 401


def test_upload_rejects_unsupported_type(user_a):
    files = {"file": ("evil.txt", b"hello world", "text/plain")}
    r = requests.post(f"{API}/documents/upload", files=files, headers=_hdr(user_a["token"]), timeout=30)
    assert r.status_code == 400
    assert "PDF" in r.text or "clear" in r.text.lower()


def test_upload_rejects_fake_mime(user_a):
    # .png filename + text/plain body -> signature check should reject
    files = {"file": ("fake.png", b"not an image", "image/png")}
    r = requests.post(f"{API}/documents/upload", files=files, headers=_hdr(user_a["token"]), timeout=30)
    assert r.status_code == 400


def test_upload_rejects_empty_file(user_a):
    files = {"file": ("empty.png", b"", "image/png")}
    r = requests.post(f"{API}/documents/upload", files=files, headers=_hdr(user_a["token"]), timeout=30)
    assert r.status_code == 400
    assert "empty" in r.text.lower()


def test_upload_rejects_oversize(user_a):
    # 11 MB blob starting with PNG signature so mime detects png but size check triggers
    big = b"\x89PNG\r\n\x1a\n" + b"\x00" * (11 * 1024 * 1024)
    files = {"file": ("big.png", big, "image/png")}
    r = requests.post(f"{API}/documents/upload", files=files, headers=_hdr(user_a["token"]), timeout=60)
    assert r.status_code == 400
    assert "too large" in r.text.lower() or "10" in r.text


def test_upload_accepts_valid_png(user_a):
    files = {"file": ("small.png", _png_bytes(), "image/png")}
    r = requests.post(f"{API}/documents/upload", files=files, headers=_hdr(user_a["token"]), timeout=30)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["mime_type"] == "image/png"
    assert doc["processing_status"] in ("processing", "processed", "failed")
    assert doc["user_id"] == user_a["uid"]
    # cleanup
    requests.delete(f"{API}/documents/{doc['id']}", headers=_hdr(user_a["token"]), timeout=15)


# --- ownership isolation ---
def test_cross_user_isolation(user_a, user_b):
    files = {"file": ("a.png", _png_bytes(), "image/png")}
    r = requests.post(f"{API}/documents/upload", files=files, headers=_hdr(user_a["token"]), timeout=30)
    assert r.status_code == 200, r.text
    doc_id = r.json()["id"]

    # B tries to GET
    r = requests.get(f"{API}/documents/{doc_id}", headers=_hdr(user_b["token"]), timeout=15)
    assert r.status_code == 404
    # B tries to GET extracted-data
    r = requests.get(f"{API}/documents/{doc_id}/extracted-data", headers=_hdr(user_b["token"]), timeout=15)
    assert r.status_code == 404
    # B tries to PATCH classification
    r = requests.patch(f"{API}/documents/{doc_id}/classification",
                       json={"document_type": "AADHAAR"},
                       headers=_hdr(user_b["token"]), timeout=15)
    assert r.status_code == 404
    # B tries to DELETE
    r = requests.delete(f"{API}/documents/{doc_id}", headers=_hdr(user_b["token"]), timeout=15)
    assert r.status_code == 404
    # A can still fetch its own document
    r = requests.get(f"{API}/documents/{doc_id}", headers=_hdr(user_a["token"]), timeout=15)
    assert r.status_code == 200
    # cleanup
    requests.delete(f"{API}/documents/{doc_id}", headers=_hdr(user_a["token"]), timeout=15)


# --- extraction pipeline (uses /tmp/mock_birth.png) ---
@pytest.fixture(scope="session")
def processed_doc(user_a):
    path = "/tmp/mock_birth.png"
    if not os.path.exists(path):
        pytest.skip("mock_birth.png missing")
    with open(path, "rb") as f:
        files = {"file": ("mock_birth.png", f.read(), "image/png")}
    r = requests.post(f"{API}/documents/upload", files=files, headers=_hdr(user_a["token"]), timeout=60)
    assert r.status_code == 200, r.text
    doc_id = r.json()["id"]
    # poll for processed
    deadline = time.time() + 60
    status = None
    while time.time() < deadline:
        rr = requests.get(f"{API}/documents/{doc_id}", headers=_hdr(user_a["token"]), timeout=15)
        assert rr.status_code == 200
        status = rr.json().get("processing_status")
        if status in ("processed", "failed"):
            break
        time.sleep(2)
    yield {"id": doc_id, "status": status}
    requests.delete(f"{API}/documents/{doc_id}", headers=_hdr(user_a["token"]), timeout=15)


def test_extraction_processed(user_a, processed_doc):
    assert processed_doc["status"] == "processed", f"final status: {processed_doc['status']}"
    r = requests.get(f"{API}/documents/{processed_doc['id']}/extracted-data",
                     headers=_hdr(user_a["token"]), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "fields" in body
    assert isinstance(body["fields"], list)
    # confidences valid
    for f in body["fields"]:
        assert 0.0 <= f["confidence"] <= 1.0
        # no fabricated null/empty values
        assert f.get("value") not in (None, "", "null")


def test_classification_correct_invalid(user_a, processed_doc):
    r = requests.patch(f"{API}/documents/{processed_doc['id']}/classification",
                       json={"document_type": "NOT_A_THING"},
                       headers=_hdr(user_a["token"]), timeout=15)
    assert r.status_code == 400


def test_classification_correct_valid(user_a, processed_doc):
    r = requests.patch(f"{API}/documents/{processed_doc['id']}/classification",
                       json={"document_type": "BIRTH_CERTIFICATE"},
                       headers=_hdr(user_a["token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["document_type"] == "BIRTH_CERTIFICATE"


# --- autofill ---
PASSPORT_FIELDS = [
    {"field_id": "given_name", "label": "Given Name (First & Middle Name)", "type": "input", "section": "Applicant Details"},
    {"field_id": "surname", "label": "Surname", "type": "input", "section": "Applicant Details"},
    {"field_id": "dob", "label": "Date of Birth", "type": "date", "section": "Applicant Details"},
    {"field_id": "gender", "label": "Gender", "type": "select", "section": "Applicant Details", "options": ["Male", "Female", "Transgender"]},
    {"field_id": "father_name", "label": "Father's Name", "type": "input"},
    {"field_id": "mother_name", "label": "Mother's Name", "type": "input"},
    {"field_id": "address", "label": "Residential Address", "type": "input"},
    {"field_id": "city", "label": "City", "type": "input"},
    {"field_id": "state", "label": "State", "type": "input"},
    {"field_id": "pincode", "label": "Pincode", "type": "input"},
    {"field_id": "mobile", "label": "Mobile Number", "type": "input"},
    {"field_id": "email", "label": "Email", "type": "input"},
    {"field_id": "spam_field", "label": "Zzzunmatched Blah Blah", "type": "input"},
]


def test_autofill_preview(user_a, processed_doc):
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": PASSPORT_FIELDS},
                      headers=_hdr(user_a["token"]), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "mappings" in body and "summary" in body
    mappings = body["mappings"]
    assert len(mappings) == len(PASSPORT_FIELDS)
    unmatched = next(m for m in mappings if m["field_id"] == "spam_field")
    assert unmatched["status"] == "missing"
    assert unmatched["value"] is None
    suggested = [m for m in mappings if m["status"] == "suggested"]
    for m in suggested:
        assert m["value"]
        assert m["source_document_type"]
        assert m["confidence_level"] in ("low", "medium", "high")


def test_autofill_confirm(user_a, processed_doc):
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": PASSPORT_FIELDS},
                      headers=_hdr(user_a["token"]), timeout=30)
    suggested = [m for m in r.json()["mappings"] if m["status"] == "suggested"]
    if not suggested:
        pytest.skip("no suggested fields to confirm")
    mappings = [{
        "field_id": m["field_id"], "value": m["value"],
        "normalization_key": m["normalization_key"],
        "source_document_id": m["source_document_id"],
    } for m in suggested[:3]]
    r = requests.post(f"{API}/autofill/confirm",
                      json={"form_id": "passport_fresh", "mappings": mappings},
                      headers=_hdr(user_a["token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["filled"] == len(mappings)
    assert isinstance(body["values"], list) and len(body["values"]) == len(mappings)


# --- regression on legacy endpoints (auth-free) ---
def test_regression_form_help():
    r = requests.post(f"{API}/form-help",
                      json={"field_label": "Given Name", "field_type": "input",
                            "form_context": "Passport"}, timeout=60)
    assert r.status_code == 200
    assert "advice" in r.json()
