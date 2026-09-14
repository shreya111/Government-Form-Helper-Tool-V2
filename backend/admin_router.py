"""Private footfall dashboard API. Only emails listed in ADMIN_EMAILS may read it.
Aggregates counts only — never returns document contents or per-user PII beyond totals."""
import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Request, Header, Query

from auth import get_current_user, is_admin

admin_router = APIRouter(prefix="/api/admin")
_db = None


def init_admin(db):
    global _db
    _db = db


async def _require_admin(request: Request, authorization: str | None):
    user = await get_current_user(request, authorization)
    if not is_admin(user.email):
        raise HTTPException(status_code=403, detail="Not authorised")
    return user


def _day(ts: str) -> str:
    return (ts or "")[:10]


async def _count_by_day(coll, field: str, since_iso: str, extra: dict | None = None):
    """{day: count} for ISO-string timestamps >= since."""
    q = {field: {"$gte": since_iso}, **(extra or {})}
    out: dict[str, int] = {}
    async for doc in coll.find(q, {"_id": 0, field: 1}):
        d = _day(doc.get(field))
        out[d] = out.get(d, 0) + 1
    return out


@admin_router.get("/summary")
async def summary(request: Request, authorization: str = Header(None), days: int = Query(14, ge=1, le=90)):
    await _require_admin(request, authorization)
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    since = start.isoformat()
    day_keys = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]

    signups = await _count_by_day(_db.users, "created_at", since)
    signins = await _count_by_day(_db.user_sessions, "created_at", since)

    # analytics events split by client (events before the client tag existed count as web)
    split = {"document_upload_completed": {}, "autofill_completed": {}}
    async for ev in _db.analytics_events.find(
        {"event": {"$in": list(split.keys())}, "timestamp": {"$gte": since}},
        {"_id": 0, "event": 1, "timestamp": 1, "props.client": 1},
    ):
        client = (ev.get("props") or {}).get("client") or "web"
        client = "extension" if client == "extension" else "web"
        bucket = split[ev["event"]].setdefault(_day(ev["timestamp"]), {"web": 0, "extension": 0})
        bucket[client] += 1

    series = []
    for d in day_keys:
        up = split["document_upload_completed"].get(d, {"web": 0, "extension": 0})
        af = split["autofill_completed"].get(d, {"web": 0, "extension": 0})
        series.append({
            "day": d, "signups": signups.get(d, 0), "signins": signins.get(d, 0),
            "uploads_web": up["web"], "uploads_extension": up["extension"],
            "autofills_web": af["web"], "autofills_extension": af["extension"],
        })

    totals = {
        "users": await _db.users.count_documents({}),
        "signups": sum(signups.values()),
        "signins": sum(signins.values()),
        "uploads": sum(v["web"] + v["extension"] for v in split["document_upload_completed"].values()),
        "autofills": sum(v["web"] + v["extension"] for v in split["autofill_completed"].values()),
        "uploads_web": sum(v["web"] for v in split["document_upload_completed"].values()),
        "uploads_extension": sum(v["extension"] for v in split["document_upload_completed"].values()),
        "autofills_web": sum(v["web"] for v in split["autofill_completed"].values()),
        "autofills_extension": sum(v["extension"] for v in split["autofill_completed"].values()),
        "form_help_requests": await _db.form_help_history.count_documents({"timestamp": {"$gte": since}}),
        "chat_messages": await _db.chat_history.count_documents({"timestamp": {"$gte": since}}),
    }
    return {"days": days, "since": since, "totals": totals, "series": series}
