"""Account registration, sign-in, sign-out and password changes."""
import asyncio
import hashlib
import secrets
import sqlite3
import time
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from auth import COOKIE_NAME, get_user, require_csrf, token_hash
from config import settings
from database import db_one, db_run, db_batch, get_db
from routes.helpers import new_id, now, check_rate

router = APIRouter()
hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
# Unknown accounts still perform the same expensive verification.
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def email_address(cls, value):
        value = value.strip().lower()
        import re
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class RegisterBody(LoginBody):
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("name")
    @classmethod
    def display_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter your name")
        return value


class PasswordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=12, max_length=128)


def auth_rate(request: Request, bucket: str, email: str = ""):
    # Never trust user-supplied forwarding headers for the limiter.
    address = request.client.host if request.client else "unknown"
    check_rate(hashlib.sha256(address.encode()).hexdigest(), "auth_" + bucket, 30)
    if email:
        check_rate(hashlib.sha256(email.encode()).hexdigest(), "auth_email_" + bucket, 10)


async def password_matches(encoded: str, password: str) -> bool:
    def verify():
        try:
            return hasher.verify(encoded, password)
        except (VerificationError, InvalidHashError):
            return False
    return await asyncio.to_thread(verify)


def set_session(response: Response, user_id: str, previous_token: str = ""):
    token = secrets.token_urlsafe(32)
    current = int(time.time())
    stmts = [("DELETE FROM auth_sessions WHERE expires_at<=?", (current,))]
    if previous_token:
        stmts.append(("DELETE FROM auth_sessions WHERE token_hash=?", (token_hash(previous_token),)))
    stmts.append(("INSERT INTO auth_sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)",
                  (token_hash(token), user_id, current, current + settings.session_days * 86400)))
    db_batch(stmts)
    response.set_cookie(COOKIE_NAME, token, max_age=settings.session_days * 86400,
                        httponly=True, secure=settings.app_env != "development",
                        samesite="lax", path="/")


@router.get("/auth/config")
async def auth_config():
    return {"provider": "password", "passwordMinLength": 12}


@router.post("/auth/register", status_code=201)
async def register(request: Request, response: Response, body: RegisterBody):
    require_csrf(request)
    auth_rate(request, "register")
    encoded = await asyncio.to_thread(hasher.hash, body.password)
    uid = new_id()
    try:
        db_batch([
            ("INSERT INTO profiles(id,name,created_at) VALUES(?,?,?)", (uid, body.name, now())),
            ("INSERT INTO auth_accounts(user_id,email,password_hash,created_at) VALUES(?,?,?,?)",
             (uid, body.email, encoded, now())),
        ])
    except sqlite3.IntegrityError:
        raise HTTPException(409, {"error": "Unable to create this account. Try signing in or use another email.", "code": "account_exists"})
    set_session(response, uid, request.cookies.get(COOKIE_NAME, ""))
    return {"user": {"id": uid, "name": body.name, "email": body.email}}


@router.post("/auth/login")
async def login(request: Request, response: Response, body: LoginBody):
    require_csrf(request)
    auth_rate(request, "login", body.email)
    row = db_one("SELECT a.*,p.name FROM auth_accounts a JOIN profiles p ON p.id=a.user_id WHERE a.email=?", body.email)
    valid = await password_matches(row["password_hash"] if row else DUMMY_HASH, body.password)
    if not row or not valid:
        raise HTTPException(401, {"error": "Email or password is incorrect.", "code": "invalid_credentials"})
    current = db_one("SELECT password_hash FROM auth_accounts WHERE user_id=?", row["user_id"])
    if not current or current["password_hash"] != row["password_hash"]:
        raise HTTPException(401, {"error": "Email or password is incorrect.", "code": "invalid_credentials"})
    if hasher.check_needs_rehash(row["password_hash"]):
        encoded = await asyncio.to_thread(hasher.hash, body.password)
        conn = get_db()
        with conn:
            updated = conn.execute("UPDATE auth_accounts SET password_hash=? WHERE user_id=? AND password_hash=?", (encoded, row["user_id"], row["password_hash"]))
            if updated.rowcount != 1:
                raise HTTPException(401, {"error": "Email or password is incorrect.", "code": "invalid_credentials"})
    set_session(response, row["user_id"], request.cookies.get(COOKIE_NAME, ""))
    return {"user": {"id": row["user_id"], "name": row["name"], "email": row["email"]}}


@router.get("/auth/me")
async def me(request: Request):
    user = get_user(request)
    row = db_one("SELECT email FROM auth_accounts WHERE user_id=?", user.id)
    return {"user": {"id": user.id, "name": user.name, "email": row["email"] if row else None}}


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    require_csrf(request)
    token = request.cookies.get(COOKIE_NAME, "")
    if token:
        db_run("DELETE FROM auth_sessions WHERE token_hash=?", token_hash(token))
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True,
                           secure=settings.app_env != "development", samesite="lax")
    return {"signedOut": True}


@router.post("/auth/password")
async def change_password(request: Request, response: Response, body: PasswordBody):
    require_csrf(request)
    user = get_user(request)
    auth_rate(request, "password")
    row = db_one("SELECT password_hash FROM auth_accounts WHERE user_id=?", user.id)
    if not row or not await password_matches(row["password_hash"], body.currentPassword):
        raise HTTPException(401, {"error": "Your current password is incorrect.", "code": "invalid_credentials"})
    encoded = await asyncio.to_thread(hasher.hash, body.newPassword)
    # Check the old hash again so concurrent changes cannot overwrite each other.
    conn = get_db()
    with conn:
        cursor = conn.execute("UPDATE auth_accounts SET password_hash=? WHERE user_id=? AND password_hash=?",
                              (encoded, user.id, row["password_hash"]))
        if cursor.rowcount != 1:
            raise HTTPException(409, {"error": "Your password changed during this request. Sign in again.", "code": "password_changed"})
        conn.execute("DELETE FROM auth_sessions WHERE user_id=?", (user.id,))
    set_session(response, user.id)
    return {"saved": True}
