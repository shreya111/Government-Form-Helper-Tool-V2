"""Document Intelligence + Autofill API. All routes require an authenticated user and enforce
per-user ownership. Raw files and extracted PII are never written to logs."""
import os
import uuid
import hashlib
import logging
import asyncio
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request, Header

from auth import get_current_user, User
from storage_service import storage
from doc_models import Document, AutofillPreviewRequest, AutofillConfirmRequest, DOCUMENT_TYPES
from doc_services import (
    validate_document, ValidationError, ManualUploadSource, extractor, mapper,
)

logger = logging.getLogger(__name__)
doc_router = APIRouter(prefix="/api")

APP_NAME = os.environ.get("APP_NAME", "formwise")
RETENTION_HOURS = int(os.environ.get("DOCUMENT_RETENTION_HOURS", "24"))
AUTOFILL_ENABLED = os.environ.get("ENABLE_DOCUMENT_AUTOFILL", "true").lower() == "true"

_db = None
_source: ManualUploadSource = None


def init_documents(db):
    global _db, _source
    _db = db
    _source = ManualUploadSource(db, storage)


async def _log_analytics(event: str, user_id: str, props: dict | None = None):
    try:
        await _db.analytics_events.insert_one({
            "event": event, "user_id": user_id, "props": props or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


async def _process(document_id: str, user_id: str):
    """Background: classify + extract. Never logs file bytes or extracted values."""
    doc = await _db.documents.find_one({"id": document_id}, {"_id": 0})
    if not doc:
        return
    await _db.documents.update_one({"id": document_id}, {"$set": {"processing_status": "processing"}})
    try:
        data, _ = storage.get(doc["storage_key"])
        result = await extractor.classify_and_extract(data, doc["mime_type"], f"extract-{document_id}")
        await _db.documents.update_one({"id": document_id}, {"$set": {
            "document_type": result["document_type"],
            "classification_confidence": result["classification_confidence"],
            "fields": [f.model_dump() for f in result["fields"]],
            "processing_status": "processed",
            "error": None,
        }})
        logger.info(f"Document processed id={document_id} type={result['document_type']} fields={len(result['fields'])}")
        await _log_analytics("document_extraction_completed", user_id, {
            "document_type": result["document_type"], "field_count": len(result["fields"])})
    except Exception as e:
        logger.error(f"Extraction failed id={document_id}: {type(e).__name__}")
        await _db.documents.update_one({"id": document_id}, {"$set": {
            "processing_status": "failed",
            "error": "We couldn't read this document. Please upload a clearer copy.",
        }})
        await _log_analytics("document_extraction_failed", user_id, {})


@doc_router.post("/documents/upload")
async def upload_document(request: Request, file: UploadFile = File(...), authorization: str = Header(None)):
    if not AUTOFILL_ENABLED:
        raise HTTPException(status_code=403, detail="Document autofill is disabled.")
    user = await get_current_user(request, authorization)
    data = await file.read()
    try:
        mime, pages = validate_document(data, file.filename)
    except ValidationError as e:
        await _log_analytics("document_upload_failed", user.user_id, {})
        raise HTTPException(status_code=400, detail=str(e))

    doc_id = str(uuid.uuid4())
    ext = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}[mime]
    path = f"{APP_NAME}/uploads/{user.user_id}/{doc_id}.{ext}"
    try:
        result = storage.put(path, data, mime)
    except Exception as e:
        logger.error(f"Storage upload failed: {type(e).__name__}")
        raise HTTPException(status_code=502, detail="Upload failed. Please try again.")

    now = datetime.now(timezone.utc)
    doc = Document(
        id=doc_id, user_id=user.user_id, original_filename=file.filename, mime_type=mime,
        file_size=len(data), storage_key=result["path"], page_count=pages,
        processing_status="processing",
        created_at=now.isoformat(), expires_at=(now + timedelta(hours=RETENTION_HOURS)).isoformat(),
    )
    await _db.documents.insert_one({**doc.model_dump(), "_ttl": now + timedelta(hours=RETENTION_HOURS)})
    await _log_analytics("document_upload_completed", user.user_id, {"mime": mime, "pages": pages})
    asyncio.create_task(_process(doc_id, user.user_id))
    return doc.model_dump()


@doc_router.get("/documents")
async def list_documents(request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    return await _source.list_documents(user.user_id)


async def _owned(document_id: str, user: User):
    doc = await _source.get_document(document_id)
    if not doc or doc["user_id"] != user.user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@doc_router.get("/documents/{document_id}")
async def get_document(document_id: str, request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    return await _owned(document_id, user)


@doc_router.get("/documents/{document_id}/extracted-data")
async def get_extracted_data(document_id: str, request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    doc = await _owned(document_id, user)
    return {"document_type": doc["document_type"], "fields": doc.get("fields", [])}


@doc_router.post("/documents/{document_id}/process")
async def reprocess_document(document_id: str, request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    await _owned(document_id, user)
    await _db.documents.update_one({"id": document_id}, {"$set": {"processing_status": "processing"}})
    asyncio.create_task(_process(document_id, user.user_id))
    return {"ok": True}


@doc_router.patch("/documents/{document_id}/classification")
async def correct_classification(document_id: str, body: dict, request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    await _owned(document_id, user)
    doc_type = body.get("document_type")
    if doc_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    await _db.documents.update_one({"id": document_id}, {"$set": {
        "document_type": doc_type, "classification_confidence": 1.0}})
    await _log_analytics("document_classified", user.user_id, {"document_type": doc_type, "manual": True})
    return {"ok": True, "document_type": doc_type}


@doc_router.delete("/documents/{document_id}")
async def delete_document(document_id: str, request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    await _owned(document_id, user)
    await _db.documents.update_one({"id": document_id}, {"$set": {"is_deleted": True}})
    await _log_analytics("document_deleted", user.user_id, {})
    return {"ok": True}


@doc_router.post("/autofill/preview")
async def autofill_preview(body: AutofillPreviewRequest, request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    documents = await _source.list_documents(user.user_id)
    result = mapper.build(body.fields, documents)
    await _log_analytics("field_mapping_generated", user.user_id, {
        "form_id": body.form_id, "client": body.client, **result["summary"]})
    return result


@doc_router.post("/autofill/confirm")
async def autofill_confirm(body: AutofillConfirmRequest, request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    events = []
    for m in body.mappings:
        events.append({
            "event": "FIELD_AUTOFILLED",
            "user_id": user.user_id,
            "form_id": body.form_id,
            "field": m.field_id,
            "normalization_key": m.normalization_key,
            "source_document_id": m.source_document_id,
            "value_hash": hashlib.sha256(m.value.encode()).hexdigest()[:16],
            "approved": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    if events:
        await _db.audit_events.insert_many(events)
    await _log_analytics("autofill_completed", user.user_id, {
        "form_id": body.form_id, "client": body.client, "count": len(body.mappings)})
    return {"ok": True, "filled": len(body.mappings),
            "values": [{"field_id": m.field_id, "value": m.value} for m in body.mappings]}
