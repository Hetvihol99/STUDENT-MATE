"""
StudyMate AI — Python FastAPI backend.

Run locally:
    pip install -r requirements.txt
    cp .env.example .env    # fill in GEMINI_API_KEY
    uvicorn main:app --reload --port 8001

All study API routes are mounted at /api/study/* to match the
Cloudflare Worker edition's contract.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from config import settings
from routes.accounts import router as accounts_router
from request_limits import RequestBodyLimit
from database import close_db, get_db          # initialises DB on first import
from routes import (
    bootstrap_router,
    materials_router,
    chat_router,
    quizzes_router,
    revision_router,
)

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="StudyMate AI — Backend",
    version="1.0.0",
    description="Personalized, source-grounded AI learning companion API.",
    docs_url="/docs",
    redoc_url="/redoc",
)

@app.middleware("http")
async def release_database(request: Request, call_next):
    try:
        response = await call_next(request)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
    finally:
        close_db()

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-StudyMate-Request", "X-Dev-User-Id", "X-Dev-User-Name"],
)

app.add_middleware(RequestBodyLimit)

# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    # Flatten detail dict to top level so the response matches
    # {error: str, code: str} — the same contract as the Cloudflare Worker.
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail, headers=exc.headers)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc.detail), "code": "error"},
    )

@app.exception_handler(RequestValidationError)
@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "error": "Some request fields are invalid. Check the input and retry.",
            "code": "validation",
        },
    )

@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=503,
        content={
            "error": "The service could not complete this operation. Please retry.",
            "code": "service_error",
        },
    )

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    """Ensure the database schema is created on first run."""
    get_db()
    close_db()

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "aiAvailable": settings.ai_available,
        "model": settings.gemini_model if settings.ai_available else None,
    }

@app.get("/ready")
async def ready():
    try:
        get_db().execute("SELECT 1").fetchone()
        return {"status": "ready"}
    except Exception as exc:
        return JSONResponse(status_code=503, content={"status": "not_ready", "error": "Database connectivity check failed."})

# ── Routes ────────────────────────────────────────────────────────────────────
PREFIX = "/api/study"

app.include_router(accounts_router, prefix=PREFIX, tags=["accounts"])
app.include_router(bootstrap_router, prefix=PREFIX, tags=["bootstrap"])
app.include_router(materials_router, prefix=PREFIX, tags=["materials"])
app.include_router(chat_router,      prefix=PREFIX, tags=["chat"])
app.include_router(quizzes_router,   prefix=PREFIX, tags=["quizzes"])
app.include_router(revision_router,  prefix=PREFIX, tags=["revision"])
