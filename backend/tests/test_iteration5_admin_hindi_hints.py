"""Iteration 5 tests: admin footfall summary, Hindi AI answers, missing-doc hints."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formwise-demo.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "test_session_conflict_2026"
PLAIN_TOKEN = "test_session_plain_2026"
DEVANAGARI = re.compile(r"[\u0900-\u097F]")


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --------- Admin summary ---------
class TestAdminSummary:
    def test_admin_summary_7d(self):
        r = requests.get(f"{BASE_URL}/api/admin/summary?days=7", headers=_h(ADMIN_TOKEN), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["days"] == 7
        assert "since" in d
        t = d["totals"]
        for k in ["users", "signups", "signins", "uploads", "autofills",
                  "uploads_web", "uploads_extension", "autofills_web", "autofills_extension",
                  "form_help_requests", "chat_messages"]:
            assert k in t, f"missing totals key: {k}"
        assert t["uploads"] == t["uploads_web"] + t["uploads_extension"]
        assert t["autofills"] == t["autofills_web"] + t["autofills_extension"]
        assert len(d["series"]) == 7
        for row in d["series"]:
            for k in ["day", "signups", "signins", "uploads_web", "uploads_extension",
                      "autofills_web", "autofills_extension"]:
                assert k in row

    def test_days_validation_low(self):
        r = requests.get(f"{BASE_URL}/api/admin/summary?days=0", headers=_h(ADMIN_TOKEN), timeout=15)
        assert r.status_code == 422

    def test_days_validation_high(self):
        r = requests.get(f"{BASE_URL}/api/admin/summary?days=91", headers=_h(ADMIN_TOKEN), timeout=15)
        assert r.status_code == 422

    def test_non_admin_forbidden(self):
        r = requests.get(f"{BASE_URL}/api/admin/summary?days=7", headers=_h(PLAIN_TOKEN), timeout=15)
        assert r.status_code == 403
        assert "Not authorised" in r.json().get("detail", "")

    def test_no_token_unauthorised(self):
        r = requests.get(f"{BASE_URL}/api/admin/summary?days=7", timeout=15)
        assert r.status_code == 401


# --------- Auth me is_admin ---------
class TestAuthMe:
    def test_me_admin_true(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(ADMIN_TOKEN), timeout=15)
        assert r.status_code == 200
        assert r.json().get("is_admin") is True

    def test_me_plain_false(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(PLAIN_TOKEN), timeout=15)
        assert r.status_code == 200
        assert r.json().get("is_admin") is False


# --------- Hindi form-help / chat ---------
class TestHindiLLM:
    def test_form_help_hindi(self):
        body = {
            "field_label": "Gender", "field_type": "select",
            "field_options": "Male, Female, Transgender", "language": "hi",
        }
        r = requests.post(f"{BASE_URL}/api/form-help", headers=_h(ADMIN_TOKEN), json=body, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        combined = (d.get("advice", "") or "") + " " + (d.get("clarification_question", "") or "")
        assert DEVANAGARI.search(combined), f"Expected Devanagari in advice/clarification: {combined[:200]}"
        # question_options recommendation should still contain the English option in quotes
        opts = d.get("question_options") or []
        assert opts, "expected question_options"
        joined_recs = " ".join(o.get("recommendation", "") for o in opts)
        assert "Male" in joined_recs or "Female" in joined_recs or "Transgender" in joined_recs, joined_recs

    def test_form_help_english(self):
        body = {
            "field_label": "Gender", "field_type": "select",
            "field_options": "Male, Female, Transgender", "language": "en",
        }
        r = requests.post(f"{BASE_URL}/api/form-help", headers=_h(ADMIN_TOKEN), json=body, timeout=90)
        assert r.status_code == 200
        d = r.json()
        combined = (d.get("advice", "") or "") + " " + (d.get("clarification_question", "") or "")
        assert not DEVANAGARI.search(combined), f"Unexpected Devanagari in English response: {combined[:200]}"

    def test_chat_hindi(self):
        body = {
            "message": "What documents do I need?",
            "page_context": {"page_title": "Passport", "page_url": "x", "form_data": {}, "page_text": ""},
            "chat_history": [], "language": "hi",
        }
        r = requests.post(f"{BASE_URL}/api/chat", headers=_h(ADMIN_TOKEN), json=body, timeout=90)
        assert r.status_code == 200, r.text
        resp = r.json().get("response", "")
        assert DEVANAGARI.search(resp), f"Expected Devanagari in chat response: {resp[:200]}"


# --------- Autofill preview hints ---------
class TestAutofillHints:
    def test_preview_hints(self):
        body = {
            "form_id": "passport_fresh",
            "client": "web",
            "fields": [
                {"field_id": "pan", "label": "PAN (if available)", "type": "input"},
                {"field_id": "vid", "label": "Voter ID (if available)", "type": "input"},
                {"field_id": "street", "label": "House No. and Street Name", "type": "input"},
                {"field_id": "gn", "label": "Given Name", "type": "input"},
            ],
        }
        r = requests.post(f"{BASE_URL}/api/autofill/preview", headers=_h(ADMIN_TOKEN), json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        mp = {m["field_id"]: m for m in d["mappings"]}
        assert mp["pan"]["status"] == "missing"
        assert mp["pan"]["suggested_documents"] == ["PAN"]
        assert mp["vid"]["status"] == "missing"
        assert mp["vid"]["suggested_documents"] == ["VOTER_ID"]
        assert mp["street"]["status"] == "missing"
        assert mp["street"]["suggested_documents"] == ["VOTER_ID", "UTILITY_BILL", "DRIVING_LICENCE"], mp["street"]["suggested_documents"]
        assert mp["gn"]["status"] == "suggested"
        assert mp["gn"]["value"] == "Aarav Sharma"

        hints = d["summary"]["upload_hints"]
        assert hints, "expected upload_hints"
        # sorted by field_count desc; VOTER_ID with 2 fields must be first
        assert hints[0]["document_type"] == "VOTER_ID"
        assert hints[0]["field_count"] == 2
        assert set(hints[0]["labels"]) == {"Voter ID (if available)", "House No. and Street Name"}
        for h in hints:
            for k in ["document_type", "priority", "field_count", "labels"]:
                assert k in h
        # AADHAAR excluded (already uploaded)
        assert all(h["document_type"] != "AADHAAR" for h in hints)
