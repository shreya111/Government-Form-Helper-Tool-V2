"""Emergent-managed Google authentication. Single auth system for the app; every document
API is scoped to the authenticated user_id. See /app/auth_testing.md for the testing flow.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta

import requests
from fastapi import APIRouter, HTTPException, Request, Response, Header
from pydantic import BaseModel

logger = logging.getLogger(__name__)

SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_DAYS = 7

auth_router = APIRouter(prefix="/api/auth")
_db = None


def is_admin(email: str) -> bool:
    allowed = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
    return bool(email) and email.lower() in allowed


def init_auth(db):
    global _db
    _db = db


class User(BaseModel):
    user_id: str
    email: str
    name: str = ""
    picture: str = ""


def _token_from_request(request: Request, authorization: str | None) -> str | None:
    token = request.cookies.get("session_token")
    if token:
        return token
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1]
    return None


async def get_current_user(request: Request, authorization: str = Header(None)) -> User:
    """Dependency: resolve the authenticated user from cookie (preferred) or Bearer token."""
    token = _token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await _db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await _db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


@auth_router.post("/session")
async def create_session(response: Response, x_session_id: str = Header(None)):
    """Exchange the Emergent one-time session_id for a persistent app session (httpOnly cookie)."""
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Missing session id")
    try:
        r = requests.get(SESSION_DATA_URL, headers={"X-Session-ID": x_session_id}, timeout=20)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Auth session-data exchange failed: {type(e).__name__}")
        raise HTTPException(status_code=401, detail="Could not verify sign-in")

    email = data.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Could not verify sign-in")

    existing = await _db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await _db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", ""), "picture": data.get("picture", "")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await _db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    session_token = data.get("session_token") or uuid.uuid4().hex
    await _db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token", value=session_token, max_age=SESSION_DAYS * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/",
    )
    # session_token is also returned so the Chrome extension (a cross-site chrome-extension:// origin
    # where third-party cookies are blocked) can store it and send it as an Authorization Bearer token.
    return {"user_id": user_id, "email": email, "name": data.get("name", ""),
            "picture": data.get("picture", ""), "session_token": session_token}


@auth_router.get("/me")
async def me(request: Request, authorization: str = Header(None)):
    user = await get_current_user(request, authorization)
    return {**user.model_dump(), "is_admin": is_admin(user.email)}


@auth_router.post("/logout")
async def logout(request: Request, response: Response, authorization: str = Header(None)):
    token = _token_from_request(request, authorization)
    if token:
        await _db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}
