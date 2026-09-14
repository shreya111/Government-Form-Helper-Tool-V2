"""Phase 2 backend tests: forms requirements, mapping guards, conflict autofill,
client field, extension endpoints. Uses seeded conflict user."""
import os
import zipfile
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formwise-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
CONFLICT_TOKEN = "test_session_conflict_2026"
HDR = {"Authorization": f"Bearer {CONFLICT_TOKEN}"}


# ---------- forms requirements ----------
def test_forms_list():
    r = requests.get(f"{API}/forms", timeout=15)
    assert r.status_code == 200
    ids = {f["form_id"] for f in r.json()}
    assert "passport_fresh" in ids and "generic" in ids


def test_forms_requirements_passport():
    r = requests.get(f"{API}/forms/passport_fresh/requirements", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["name"]["en"] and body["name"]["hi"]
    docs = body["documents"]
    assert len(docs) == 7
    for d in docs:
        assert d["document_type"]
        assert d["priority"] in ("recommended", "optional")
        assert d["purpose"]["en"] and d["purpose"]["hi"]
        assert isinstance(d["provides"], list) and d["provides"]


def test_forms_requirements_fallback_generic():
    r = requests.get(f"{API}/forms/whatever/requirements", timeout=15)
    assert r.status_code == 200
    assert r.json()["form_id"] == "generic"


# ---------- documents list for conflict user ----------
def test_documents_list_conflict_user():
    r = requests.get(f"{API}/documents", headers=HDR, timeout=20)
    assert r.status_code == 200
    docs = r.json()
    ids = {d["id"] for d in docs}
    assert "seed-aadhaar-1" in ids
    assert "seed-birth-1" in ids


# ---------- autofill preview conflict + guards ----------
CONFLICT_FIELDS = [
    {"field_id": "dob", "label": "Date of Birth", "type": "input"},
    {"field_id": "gn", "label": "Given Name", "type": "input"},
]


def test_autofill_preview_conflict_dob():
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": CONFLICT_FIELDS},
                      headers=HDR, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["summary"]["conflicts"] == 1
    dob = next(m for m in body["mappings"] if m["field_id"] == "dob")
    assert dob.get("conflict") is True
    alts = dob.get("alternatives") or []
    assert len(alts) == 2
    vals = {a["value"] for a in alts}
    srcs = {a.get("source_document_type") for a in alts}
    assert "11/10/1997" in vals and "11/10/1998" in vals
    assert "AADHAAR" in srcs and "BIRTH_CERTIFICATE" in srcs
    assert dob["value"] == "11/10/1997"


def test_autofill_preview_requires_auth():
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": CONFLICT_FIELDS},
                      timeout=15)
    assert r.status_code == 401


def test_autofill_confirm_requires_auth():
    r = requests.post(f"{API}/autofill/confirm",
                      json={"form_id": "passport_fresh", "mappings": []},
                      timeout=15)
    assert r.status_code == 401


def test_autofill_accepts_client_field():
    payload = {"form_id": "passport_fresh", "client": "extension", "fields": CONFLICT_FIELDS}
    r = requests.post(f"{API}/autofill/preview", json=payload, headers=HDR, timeout=30)
    assert r.status_code == 200
    # confirm with client
    dob = next(m for m in r.json()["mappings"] if m["field_id"] == "dob")
    conf_payload = {
        "form_id": "passport_fresh",
        "client": "extension",
        "mappings": [{
            "field_id": "dob", "value": dob["value"],
            "normalization_key": dob.get("normalization_key"),
            "source_document_id": dob.get("source_document_id"),
        }],
    }
    r = requests.post(f"{API}/autofill/confirm", json=conf_payload, headers=HDR, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["filled"] == 1


# ---------- mapping guards ----------
def test_mapping_choice_field_gender():
    fields = [{"field_id": "g", "label": "Gender", "type": "select",
               "options": ["Male", "Female", "Transgender"]}]
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": fields},
                      headers=HDR, timeout=30)
    assert r.status_code == 200
    m = r.json()["mappings"][0]
    assert m["status"] == "suggested"
    assert m["value"] == "Male"


def test_mapping_radio_skip_out_of_india():
    fields = [{"field_id": "ooi", "label": "Is your place of birth out of India?",
               "type": "radio", "options": ["Yes", "No"]}]
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": fields},
                      headers=HDR, timeout=30)
    assert r.status_code == 200
    m = r.json()["mappings"][0]
    assert m["status"] == "missing"


def test_mapping_skip_legal_guardian():
    fields = [{"field_id": "lg", "label": "Legal Guardian's Given Name (if applicable)",
               "type": "input"}]
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": fields},
                      headers=HDR, timeout=30)
    assert r.status_code == 200
    m = r.json()["mappings"][0]
    assert m["status"] == "missing"


def test_mapping_skip_emergency_section():
    fields = [{"field_id": "en", "label": "Name and Address",
               "type": "input", "section": "Emergency Contact"}]
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": fields},
                      headers=HDR, timeout=30)
    assert r.status_code == 200
    m = r.json()["mappings"][0]
    assert m["status"] == "missing"


def test_mapping_city_present_address_suggests_pune():
    fields = [{"field_id": "city", "label": "City / Town",
               "type": "input", "section": "Present Address"}]
    r = requests.post(f"{API}/autofill/preview",
                      json={"form_id": "passport_fresh", "fields": fields},
                      headers=HDR, timeout=30)
    assert r.status_code == 200
    m = r.json()["mappings"][0]
    assert m["status"] == "suggested"
    assert m["value"] == "Pune"


# ---------- regression legacy endpoints ----------
def test_form_help_regression():
    r = requests.post(f"{API}/form-help",
                      json={"field_label": "Given Name", "field_type": "input",
                            "form_context": "Passport"}, timeout=60)
    assert r.status_code == 200
    assert "advice" in r.json()


def test_extension_download():
    r = requests.get(f"{API}/extension/download", timeout=30)
    assert r.status_code == 200
    assert "zip" in r.headers.get("content-type", "").lower() or len(r.content) > 1000
    # sanity: is a valid zip
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    assert any("manifest" in n.lower() for n in zf.namelist())
