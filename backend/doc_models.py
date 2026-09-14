"""Document-intelligence data models and the field ontology used to map government-form
labels to a stable set of concepts. Keep form/document rules here, not scattered in the UI."""
import re
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field

# ---- document types ----
DOCUMENT_TYPES = [
    "AADHAAR", "PAN", "BIRTH_CERTIFICATE", "DRIVING_LICENCE", "VOTER_ID", "PASSPORT",
    "CLASS_10_CERTIFICATE", "ADDRESS_PROOF", "UTILITY_BILL", "OTHER", "UNKNOWN",
]

# ---- field ontology (stable concepts) ----
ONTOLOGY_KEYS = [
    "full_name", "first_name", "middle_name", "last_name", "date_of_birth", "gender",
    "address", "house_number", "street", "city", "district", "state", "pincode",
    "mobile_number", "email", "father_name", "mother_name", "spouse_name",
    "nationality", "document_number", "place_of_birth", "marital_status",
]

# form-label keyword -> ontology key (ordered: most specific first)
_LABEL_KEYWORDS: list[tuple[str, str]] = [
    ("father", "father_name"), ("mother", "mother_name"),
    ("spouse", "spouse_name"), ("husband", "spouse_name"), ("wife", "spouse_name"),
    ("date of birth", "date_of_birth"), ("birth date", "date_of_birth"), ("dob", "date_of_birth"),
    ("place of birth", "place_of_birth"), ("birth place", "place_of_birth"),
    ("marital", "marital_status"),
    ("given name", "full_name"), ("first & middle", "full_name"), ("first and middle", "full_name"),
    ("full name", "full_name"), ("applicant name", "full_name"), ("name of applicant", "full_name"),
    ("first name", "first_name"), ("middle name", "middle_name"),
    ("surname", "last_name"), ("last name", "last_name"), ("family name", "last_name"),
    ("gender", "gender"), ("sex", "gender"),
    ("pin code", "pincode"), ("pincode", "pincode"), ("postal code", "pincode"), ("zip", "pincode"),
    ("mobile", "mobile_number"), ("phone", "mobile_number"), ("contact number", "mobile_number"),
    ("email", "email"), ("e-mail", "email"),
    ("house no", "street"), ("house number", "street"), ("street", "street"),
    ("city", "city"), ("town", "city"),
    ("district", "district"),
    ("state", "state"),
    ("nationality", "nationality"),
    ("passport number", "document_number"), ("document number", "document_number"),
    ("address", "address"), ("residential", "address"),
    ("name", "full_name"),  # generic fallback, keep last
]

# Fields about someone/something other than the applicant's own details: never autofill from documents.
SKIP_KEYWORDS = ["guardian", "emergency", "reference", "nominee", "out of india", "previous passport", "old passport"]


def normalize_label(label: str) -> Optional[str]:
    """Map a raw form-field label to an ontology key using keyword matching."""
    if not label:
        return None
    low = label.lower()
    if any(kw in low for kw in SKIP_KEYWORDS):
        return None
    for kw, key in _LABEL_KEYWORDS:
        if kw in low:
            return key
    return None


def match_option(value: str, options: list[str]) -> Optional[str]:
    """Pick the form option a document value refers to (exact, then prefix, then containment)."""
    v = (value or "").strip().lower()
    if not v:
        return None
    norm = [(o, o.strip().lower()) for o in options if o and o.strip()]
    for o, low in norm:
        if low == v:
            return o
    for o, low in norm:
        if low.startswith(v) or v.startswith(low):
            return o
    for o, low in norm:
        if re.search(rf"(^|\W){re.escape(v)}(\W|$)", low) or re.search(rf"(^|\W){re.escape(low)}(\W|$)", v):
            return o
    return None


class ExtractedField(BaseModel):
    field_name: str
    value: Optional[str] = None
    normalized_value: Optional[str] = None
    normalization_key: Optional[str] = None
    confidence: float = 0.0
    page_number: int = 1
    extraction_method: str = "gemini-vision"


class Document(BaseModel):
    id: str
    user_id: str
    session_id: Optional[str] = None
    source_type: str = "manual_upload"
    document_type: str = "UNKNOWN"
    classification_confidence: float = 0.0
    original_filename: str
    mime_type: str
    file_size: int
    storage_key: str
    page_count: int = 1
    processing_status: str = "uploaded"  # uploaded|processing|processed|failed
    error: Optional[str] = None
    fields: List[ExtractedField] = []
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None


class FormFieldSpec(BaseModel):
    field_id: str
    label: str
    type: str = "input"
    required: bool = False
    section: Optional[str] = None
    options: List[str] = []


class AutofillPreviewRequest(BaseModel):
    form_id: str = "passport_fresh"
    client: str = "web"  # web | extension
    fields: List[FormFieldSpec]


class ConfirmMapping(BaseModel):
    field_id: str
    value: str
    normalization_key: Optional[str] = None
    source_document_id: Optional[str] = None


class AutofillConfirmRequest(BaseModel):
    form_id: str = "passport_fresh"
    client: str = "web"
    mappings: List[ConfirmMapping]
