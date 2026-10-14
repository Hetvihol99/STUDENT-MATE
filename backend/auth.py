"""Cookie sessions for accounts; dev identities require explicit opt-in."""
import hashlib
import time
from dataclasses import dataclass
from fastapi import Request, HTTPException
from config import settings
from database import db_one

COOKIE_NAME = "studymate_session"


@dataclass
class User:
    id: str
    name: str


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_user(request: Request) -> User:
    if settings.auth_mode == "development" and settings.app_env == "development":
        uid = request.headers.get("X-Dev-User-Id") or settings.dev_user_id
        name = request.headers.get("X-Dev-User-Name") or settings.dev_user_name
        if uid:
            return User(id=uid[:160], name=name[:120])
    token = request.cookies.get(COOKIE_NAME, "")
    if token and len(token) <= 128:
        row = db_one(
            "SELECT p.id,p.name FROM auth_sessions s JOIN profiles p ON p.id=s.user_id "
            "WHERE s.token_hash=? AND s.expires_at>?",
            token_hash(token), int(time.time()),
        )
        if row:
            return User(id=row["id"], name=row["name"])
    raise HTTPException(401, {
        "error": "Sign in to access your private learning workspace.",
        "code": "unauthenticated",
    })


def require_csrf(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    if request.headers.get("X-StudyMate-Request") != "1":
        raise HTTPException(403, {"error": "Use the application to submit this request.", "code": "origin"})
    origin = request.headers.get("Origin")
    if request.headers.get("Sec-Fetch-Site") == "cross-site" or (origin and origin not in {
        *settings.allowed_origins, str(request.base_url).rstrip("/"),
    }):
        raise HTTPException(403, {"error": "Cross-site requests are not allowed.", "code": "origin"})
