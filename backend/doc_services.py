"""Document pipeline services: validation, document sources (manual upload + DigiLocker stub),
Gemini-vision extraction behind a swappable adapter, and form-field mapping."""
import os
import io
import json
import base64
import logging
import tempfile
from abc import ABC, abstractmethod
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType, ImageContent

from doc_models import DOCUMENT_TYPES, ONTOLOGY_KEYS, SKIP_KEYWORDS, normalize_label, match_option, ExtractedField

logger = logging.getLogger(__name__)

ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png"}
MAX_SIZE_MB = int(os.environ.get("MAX_DOCUMENT_SIZE_MB", "10"))
MAX_PDF_PAGES = 20
_MODEL = os.environ.get("DOC_EXTRACTION_MODEL", "gemini-2.5-flash")
_KEY = os.environ.get("EMERGENT_LLM_KEY")

_SIGNATURES = {
    b"%PDF": "application/pdf",
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
}


class ValidationError(Exception):
    """User-safe validation message."""


def validate_document(data: bytes, filename: str) -> tuple[str, int]:
    """Server-side validation (never trusts browser MIME). Returns (mime_type, page_count)."""
    if not data:
        raise ValidationError("This file is empty. Please upload a valid document.")
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise ValidationError(f"This file is too large. Maximum size is {MAX_SIZE_MB} MB.")

    mime = next((m for sig, m in _SIGNATURES.items() if data.startswith(sig)), None)
    if not mime or mime not in ALLOWED_MIME:
        raise ValidationError("We couldn't read this document. Please upload a clear PDF, JPG or PNG.")

    if mime == "application/pdf":
        try:
            with fitz.open(stream=data, filetype="pdf") as pdf:
                pages = pdf.page_count
        except Exception:
            raise ValidationError("This PDF appears to be corrupted. Please upload a clear copy.")
        if pages == 0:
            raise ValidationError("This PDF has no readable pages.")
        if pages > MAX_PDF_PAGES:
            raise ValidationError(f"This PDF has too many pages (max {MAX_PDF_PAGES}).")
        return mime, pages

    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()
    except Exception:
        raise ValidationError("We couldn't read this image. Please upload a clearer JPG or PNG.")
    return mime, 1


# ---------- document sources ----------
class DocumentSource(ABC):
    source_type = "abstract"

    @abstractmethod
    async def list_documents(self, user_id: str): ...

    @abstractmethod
    async def get_document(self, document_id: str): ...

    @abstractmethod
    async def get_document_metadata(self, document_id: str): ...


class ManualUploadSource(DocumentSource):
    """The only active source in V1: user-provided uploads stored in object storage."""
    source_type = "manual_upload"

    def __init__(self, db, storage):
        self.db = db
        self.storage = storage

    async def list_documents(self, user_id: str):
        return await self.db.documents.find(
            {"user_id": user_id, "is_deleted": False}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)

    async def get_document(self, document_id: str):
        return await self.db.documents.find_one({"id": document_id, "is_deleted": False}, {"_id": 0})

    async def get_document_metadata(self, document_id: str):
        doc = await self.get_document(document_id)
        if not doc:
            return None
        return {k: v for k, v in doc.items() if k != "fields"}


class DigiLockerSource(DocumentSource):
    """FUTURE (disabled). Retrieves issued documents via official DigiLocker consent flow.
    TODO: implement OAuth consent, issued-document listing, and provenance metadata.
    Do NOT implement login/scraping/unofficial APIs here."""
    source_type = "digilocker"
    enabled = False

    def __init__(self, *_, **__):
        pass

    async def list_documents(self, user_id: str):
        raise NotImplementedError("DigiLocker integration is not enabled yet.")

    async def get_document(self, document_id: str):
        raise NotImplementedError("DigiLocker integration is not enabled yet.")

    async def get_document_metadata(self, document_id: str):
        raise NotImplementedError("DigiLocker integration is not enabled yet.")


# ---------- extraction adapter ----------
class ExtractionService(ABC):
    @abstractmethod
    async def classify_and_extract(self, data: bytes, mime: str, session_id: str) -> dict: ...


def _prepare_image(data: bytes) -> str:
    """Resize + re-encode to keep the base64 payload small before sending to the model."""
    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB")
        img.thumbnail((1600, 1600))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode()


_SYSTEM = (
    "You are a precise document-understanding engine for Indian identity and civil documents. "
    "You extract ONLY what is clearly present. You never invent, guess, or infer values that are "
    "not visibly written in the document. Missing values must be null. Return strict JSON only."
)


def _extraction_prompt() -> str:
    return f"""Analyse the attached document image/PDF.

1. Classify the document. document_type MUST be one of: {", ".join(DOCUMENT_TYPES)}.
2. Extract personal information fields that are clearly present. Each field name MUST be one of:
   {", ".join(ONTOLOGY_KEYS)}.
   - Normalise dates to DD/MM/YYYY.
   - gender must be one of: Male, Female, Transgender.
   - For pincode extract only the 6-digit code; for city/state/district extract them separately when visible.
   - document_number = the primary ID number on the document (Aadhaar/PAN/passport no. etc.).
3. Give a confidence between 0 and 1 for the classification and for each field, reflecting how clearly
   it was readable. Lower confidence for blurry/partial text.

Return STRICT JSON, no markdown, exactly:
{{
  "document_type": "AADHAAR",
  "classification_confidence": 0.0,
  "fields": [
    {{"name": "full_name", "value": "string or null", "confidence": 0.0, "page": 1}}
  ]
}}
If a field is not present, omit it or set value to null. Do NOT fabricate."""


def _parse_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```json"):
        t = t[7:]
    if t.startswith("```"):
        t = t[3:]
    if t.endswith("```"):
        t = t[:-3]
    return json.loads(t.strip())


class GeminiExtractionService(ExtractionService):
    """Active adapter. Wraps Gemini multimodal vision via emergentintegrations.
    Swap for Tesseract / Google Document AI / AWS Textract by implementing ExtractionService."""

    async def classify_and_extract(self, data: bytes, mime: str, session_id: str) -> dict:
        chat = LlmChat(api_key=_KEY, session_id=session_id, system_message=_SYSTEM).with_model("gemini", _MODEL)
        tmp_path = None
        try:
            if mime == "application/pdf":
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                    f.write(data)
                    tmp_path = f.name
                contents = [FileContentWithMimeType(file_path=tmp_path, mime_type="application/pdf")]
            else:
                contents = [ImageContent(image_base64=_prepare_image(data))]
            resp = await chat.send_message(UserMessage(text=_extraction_prompt(), file_contents=contents))
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

        parsed = _parse_json(resp)
        doc_type = parsed.get("document_type", "UNKNOWN")
        if doc_type not in DOCUMENT_TYPES:
            doc_type = "UNKNOWN"
        fields = []
        for f in parsed.get("fields", []):
            key = f.get("name")
            value = f.get("value")
            if key not in ONTOLOGY_KEYS or value in (None, "", "null"):
                continue
            fields.append(ExtractedField(
                field_name=key,
                value=str(value).strip(),
                normalized_value=str(value).strip(),
                normalization_key=key,
                confidence=max(0.0, min(1.0, float(f.get("confidence", 0.5) or 0.5))),
                page_number=int(f.get("page", 1) or 1),
            ))
        return {
            "document_type": doc_type,
            "classification_confidence": max(0.0, min(1.0, float(parsed.get("classification_confidence", 0.5) or 0.5))),
            "fields": fields,
        }


extractor: ExtractionService = GeminiExtractionService()


# ---------- field mapping ----------
def _confidence_level(c: float) -> str:
    return "high" if c >= 0.85 else "medium" if c >= 0.6 else "low"


class FieldMappingService:
    """Maps government form fields to approved extracted document fields via the ontology.
    Detects cross-document value conflicts and surfaces them (never auto-resolves)."""

    def build(self, form_fields: list, documents: list) -> dict:
        # collect candidates per ontology key from all processed documents
        candidates: dict[str, list] = {}
        for doc in documents:
            if doc.get("processing_status") != "processed":
                continue
            for f in doc.get("fields", []):
                key = f.get("normalization_key")
                if not key or not f.get("value"):
                    continue
                candidates.setdefault(key, []).append({
                    "value": f["value"],
                    "confidence": f.get("confidence", 0.0),
                    "source_document_id": doc["id"],
                    "source_document_type": doc.get("document_type", "UNKNOWN"),
                })

        mappings = []
        for ff in form_fields:
            section = (ff.section or "").lower()
            key = None if any(kw in section for kw in SKIP_KEYWORDS) else normalize_label(ff.label)
            cands = sorted(candidates.get(key, []), key=lambda c: c["confidence"], reverse=True) if key else []
            # choice fields: only suggest values that actually correspond to one of the form's options
            if cands and ff.options:
                matched = []
                for c in cands:
                    opt = match_option(c["value"], ff.options)
                    if opt:
                        matched.append({**c, "value": opt})
                cands = matched
            if not cands:
                mappings.append({
                    "field_id": ff.field_id, "label": ff.label, "section": ff.section,
                    "normalization_key": key, "value": None, "confidence": 0.0,
                    "confidence_level": "low", "status": "missing",
                    "source_document_id": None, "source_document_type": None,
                    "alternatives": [], "conflict": False,
                })
                continue
            best = cands[0]
            distinct = {c["value"].strip().lower() for c in cands}
            conflict = len(distinct) > 1
            mappings.append({
                "field_id": ff.field_id, "label": ff.label, "section": ff.section,
                "normalization_key": key, "value": best["value"],
                "confidence": best["confidence"], "confidence_level": _confidence_level(best["confidence"]),
                "status": "suggested",
                "source_document_id": best["source_document_id"],
                "source_document_type": best["source_document_type"],
                "alternatives": cands,
                "conflict": conflict,
            })

        suggested = [m for m in mappings if m["status"] == "suggested"]
        return {
            "mappings": mappings,
            "summary": {
                "total": len(mappings),
                "suggested": len(suggested),
                "missing": len(mappings) - len(suggested),
                "conflicts": len([m for m in suggested if m["conflict"]]),
            },
        }


mapper = FieldMappingService()
