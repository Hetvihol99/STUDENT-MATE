"""Materials upload, file serving, page viewing, rename, delete."""
import json
from pathlib import Path
from fastapi import APIRouter, Request, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, Response, RedirectResponse
from pydantic import BaseModel, field_validator
from database import db_one, db_all, db_run, db_batch
from auth import get_user, require_csrf
from config import settings
from services.extraction import extract_pages
from services.video import VIDEO_MIMES, youtube_url, validate_video, extract_video, extract_youtube, transcript_pages
from routes.helpers import new_id, now, add_event, check_rate, owned_material, owned_course, add_source

router = APIRouter()


def _save_file(key: str, data: bytes) -> None:
    p = Path(settings.storage_path) / key.replace("/", "_")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)


def _load_file(key: str) -> bytes | None:
    p = Path(settings.storage_path) / key.replace("/", "_")
    return p.read_bytes() if p.exists() else None


def _delete_file(key: str) -> None:
    p = Path(settings.storage_path) / key.replace("/", "_")
    if p.exists():
        p.unlink()


def _upload_context(request: Request, course: str):
    require_csrf(request)
    user = get_user(request)
    if not db_one("SELECT id FROM profiles WHERE id=?", user.id):
        raise HTTPException(409, {"error": "Initialize your workspace first.", "code": "profile_required"})
    check_rate(user.id, "upload", settings.rate_limit_upload)
    count = db_one("SELECT count(*) n FROM materials WHERE owner_id=? AND deleted_at IS NULL", user.id)
    if count and count["n"] >= 50:
        raise HTTPException(409, {"error": "Material limit reached (50). Delete unused files first.", "code": "quota"})
    course = course.strip()
    if not course or len(course) > 120:
        raise HTTPException(400, {"error": "Choose an existing course.", "code": "form"})
    return user, owned_course(user.id, course)


def _begin(user_id, course_id, name, kind, key, size):
    mid = new_id()
    db_run("INSERT INTO materials(id,owner_id,course_id,name,type,status,storage_key,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
           mid, user_id, course_id, name, kind, "processing", key, size, now())
    return mid


def _finish(mid, user_id, course_id, name, pages, video=False):
    add_source(mid, pages)
    statements = [("UPDATE materials SET status='ready',pages=?,error=NULL WHERE id=?", (len(pages), mid))]
    source_pages = list(enumerate(pages, 1)) if video else [next(((i, text) for i, text in enumerate(pages, 1) if text.strip()), (1, pages[0]))]
    for page, text in source_pages:
        tid = f"{mid}_segment_{page}" if video else mid
        topic_name = f"{name} · section {page}" if video else name.rsplit('.', 1)[0]
        data = json.dumps({"id": tid, "name": topic_name, "page": page,
                           "prereq": "Read the source", "text": text[:2000],
                           "example": "Open the source and practice this section.", "materialId": mid, "sourceTitle": name})
        statements += [
            ("INSERT INTO topics(id,owner_id,course_id,name,data,mastery,attempts,correct,last) VALUES(?,?,?,?,?,0,0,0,'Not practiced')", (tid, user_id, course_id, topic_name, data)),
            ("INSERT INTO flashcards(id,owner_id,topic_id,front,back) VALUES(?,?,?,?,?)", (f"{tid}_card", user_id, tid, f"Recall the key ideas from {topic_name}", text[:1200])),
        ]
    statements.append(("INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)", (new_id(), user_id, f"Processed {name}", now())))
    db_batch(statements)
    return {"id": mid, "status": "ready", "pages": len(pages)}


def _fail(mid, exc):
    db_run("DELETE FROM pages WHERE material_id=?", mid)
    detail = exc.detail if isinstance(exc, HTTPException) else None
    error = detail.get("error", "Processing failed.") if isinstance(detail, dict) else "Processing failed."
    db_run("UPDATE materials SET status='failed',error=? WHERE id=?", error, mid)


@router.post("/materials", status_code=201)
async def upload_material(request: Request, file: UploadFile, course: str = Form(...), transcript: str = Form("")):
    user, c = _upload_context(request, course)
    filename = Path((file.filename or "upload.pdf").replace("\x00", "_")).name[:150]
    video = Path(filename).suffix.lower() in VIDEO_MIMES
    limit = (settings.max_video_mb if video else settings.max_upload_mb) * 1024 * 1024
    content = await file.read(limit + 1)
    mime = file.content_type or ""
    await file.close()
    if len(content) > limit:
        raise HTTPException(413, {"error": f"File exceeds {limit // 1024 // 1024} MB limit.", "code": "file_size"})
    if video:
        mime = validate_video(filename, content, mime)
        if not transcript.strip() and not settings.ai_available:
            raise HTTPException(503, {"error": "Automatic video extraction needs Gemini. Paste a transcript to add this video without AI extraction.", "code": "ai_unavailable"})
    key = f"{user.id}/{new_id()}"
    mid = _begin(user.id, c["id"], filename, "Video" if video else ("PDF" if filename.lower().endswith('.pdf') else "Text"), key, len(content))
    try:
        _save_file(key, content)
        if video:
            pages = transcript_pages(transcript) if transcript.strip() else (await extract_video(filename, content, mime))[1]
            db_run("INSERT INTO material_media(material_id,video_url,mime_type,transcript_source) VALUES(?,NULL,?,?)", mid, mime, "provided" if transcript.strip() else "ai")
        else:
            pages = extract_pages(filename, content, mime)
        return _finish(mid, user.id, c["id"], filename, pages, video)
    except HTTPException as exc:
        _fail(mid, exc)
        raise
    except Exception as exc:
        _fail(mid, exc)
        raise HTTPException(503, {"error": "Processing failed. You can delete the failed record and retry.", "code": "processing_failed"}) from exc


class YouTubeBody(BaseModel):
    course: str
    url: str
    name: str = ""
    transcript: str = ""

    @field_validator("url")
    @classmethod
    def validate_url(cls, value):
        if len(value) > 2048:
            raise ValueError("Link too long")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if len(value.strip()) > 120:
            raise ValueError("Name must be at most 120 characters")
        return value.strip()


@router.post("/materials/youtube", status_code=201)
async def add_youtube(request: Request, body: YouTubeBody):
    user, course = _upload_context(request, body.course)
    canonical, video_id = youtube_url(body.url)
    if not body.transcript.strip() and not settings.ai_available:
        raise HTTPException(503, {"error": "Automatic YouTube extraction needs Gemini. Paste the video transcript to add it without AI extraction.", "code": "ai_unavailable"})
    name = body.name or f"YouTube lesson · {video_id}"
    mid = _begin(user.id, course["id"], name, "YouTube", "", 0)
    try:
        if body.transcript.strip():
            pages = transcript_pages(body.transcript)
        else:
            title, pages = await extract_youtube(canonical)
            if not body.name:
                name = title
                db_run("UPDATE materials SET name=? WHERE id=?", name, mid)
        db_run("INSERT INTO material_media(material_id,video_url,mime_type,transcript_source) VALUES(?,?,?,?)", mid, canonical, "video/mp4", "provided" if body.transcript.strip() else "ai")
        return _finish(mid, user.id, course["id"], name, pages, video=True)
    except HTTPException as exc:
        _fail(mid, exc)
        raise
    except Exception as exc:
        _fail(mid, exc)
        raise HTTPException(503, {"error": "Could not process this YouTube video. Try a public video or paste its transcript.", "code": "processing_failed"}) from exc


@router.get("/materials/{mid}/file")
async def get_file(mid: str, request: Request):
    user = get_user(request)
    m = owned_material(user.id, mid)
    if m["status"] == "deleting":
        raise HTTPException(404, {"error": "Material not found.", "code": "not_found"})
    media = db_one("SELECT * FROM material_media WHERE material_id=?", mid)
    if m["type"] == "YouTube":
        if not media or not media["video_url"]:
            raise HTTPException(404, {"error": "Video link is unavailable.", "code": "file_missing"})
        canonical, _ = youtube_url(media["video_url"])
        return RedirectResponse(canonical, status_code=307, headers={"Cache-Control": "private, no-store"})
    if m["type"] == "Video":
        path = Path(settings.storage_path) / m["storage_key"].replace("/", "_")
        if not path.is_file():
            raise HTTPException(404, {"error": "Stored video is unavailable.", "code": "file_missing"})
        mime = media["mime_type"] if media else VIDEO_MIMES.get(path.suffix.lower(), "video/mp4")
        return FileResponse(path, media_type=mime, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline"})
    data = _load_file(m["storage_key"])
    if data is None:
        raise HTTPException(404, {"error": "The stored file is unavailable.", "code": "file_missing"})
    ctype = "application/pdf" if m["type"] == "PDF" else "text/plain; charset=utf-8"
    safe_name = "".join(c if 0x20 <= ord(c) <= 0x7e and c not in '"\\' else "_" for c in m["name"])
    return Response(
        content=data, media_type=ctype,
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        }
    )


@router.get("/materials/{mid}/pages")
async def get_page(mid: str, page: int, request: Request):
    user = get_user(request)
    m = owned_material(user.id, mid)
    if not (1 <= page <= settings.max_pdf_pages):
        raise HTTPException(400, {"error": f"Page must be between 1 and {settings.max_pdf_pages}.", "code": "validation"})
    if m["status"] != "ready":
        raise HTTPException(409, {"error": "This material is not ready.", "code": "not_ready"})
    p = db_one("SELECT page,text FROM pages WHERE material_id=? AND page=?", mid, page)
    if not p:
        raise HTTPException(404, {"error": "Source page not found.", "code": "page_missing"})
    media = db_one("SELECT * FROM material_media WHERE material_id=?", mid)
    return {"page": p["page"], "text": p["text"], "title": m["name"], "materialId": mid, "type": m["type"], "pages": m["pages"],
            "videoUrl": media["video_url"] if media else None, "transcriptSource": media["transcript_source"] if media else None}


class RenameBody(BaseModel):
    name: str
    @field_validator("name")
    @classmethod
    def v(cls, v):
        v = v.strip()
        if not 1 <= len(v) <= 120:
            raise ValueError("Name must be 1–120 characters")
        return v


@router.patch("/materials/{mid}")
async def rename_material(mid: str, request: Request, body: RenameBody):
    require_csrf(request)
    user = get_user(request)
    m = owned_material(user.id, mid)
    db_run("UPDATE materials SET name=? WHERE id=? AND owner_id=?", body.name, m["id"], user.id)
    return {"saved": True}


@router.delete("/materials/{mid}")
async def delete_material(mid: str, request: Request):
    require_csrf(request)
    user = get_user(request)
    m = owned_material(user.id, mid)
    db_run("UPDATE materials SET status='deleting' WHERE id=?", m["id"])
    if m["storage_key"]:
        _delete_file(m["storage_key"])
    db_batch([
        ("DELETE FROM material_media WHERE material_id=?", (m["id"],)),
        ("DELETE FROM pages WHERE material_id=?", (m["id"],)),
        ("DELETE FROM quizzes WHERE material_id=?", (m["id"],)),
        ("DELETE FROM conversations WHERE owner_id=? AND course_id=?", (user.id, m["course_id"])),
        ("DELETE FROM flashcards WHERE topic_id IN (SELECT id FROM topics WHERE owner_id=? AND json_extract(data,'$.materialId')=?)", (user.id, m["id"])),
        ("DELETE FROM topics WHERE owner_id=? AND json_extract(data,'$.materialId')=?", (user.id, m["id"])),
        ("UPDATE materials SET deleted_at=?,status='deleted' WHERE id=?", (now(), m["id"])),
        ("INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
         (new_id(), user.id, "Deleted material and its learning content", now())),
    ])
    return {"deleted": True}
