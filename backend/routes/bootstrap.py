"""Bootstrap, state, profile, seed, and courses endpoints."""
import json
import hashlib
from fastapi import APIRouter, Request
from pydantic import BaseModel, field_validator
from database import db_one, db_all, db_run, db_batch
from auth import get_user, require_csrf
from config import settings
from services.curriculum import INITIAL_TOPICS, QUESTION_BANK
from routes.helpers import new_id, now, add_event, check_rate, add_source

router = APIRouter()


def _build_state(user_id: str, user_name: str) -> dict:
    profile = db_one("SELECT name FROM profiles WHERE id=?", user_id)
    courses = db_all("SELECT id,name FROM courses WHERE owner_id=? ORDER BY created_at,id", user_id)
    materials = db_all(
        "SELECT m.*,c.name AS course,md.video_url,md.transcript_source FROM materials m "
        "JOIN courses c ON c.id=m.course_id LEFT JOIN material_media md ON md.material_id=m.id "
        "WHERE m.owner_id=? AND m.deleted_at IS NULL ORDER BY m.created_at DESC",
        user_id
    )
    topics = db_all("SELECT * FROM topics WHERE owner_id=? ORDER BY course_id,id", user_id)
    attempts = db_all("SELECT data FROM attempts WHERE owner_id=? ORDER BY created_at DESC LIMIT 100", user_id)
    activity = db_all("SELECT text FROM activity WHERE owner_id=? ORDER BY created_at DESC LIMIT 30", user_id)
    revisions = db_all(
        "SELECT DISTINCT t.data FROM revisions r JOIN topics t ON t.id=r.topic_id WHERE r.owner_id=?",
        user_id
    )
    status_label = {"ready": "Ready to study", "processing": "Processing",
                    "failed": "Processing failed", "deleting": "Deleting"}
    return {
        "user": {"name": profile["name"] if profile else user_name},
        "aiAvailable": settings.ai_available,
        "videoAvailable": True,
        "limits": {"uploadMb": settings.max_upload_mb, "videoMb": settings.max_video_mb, "videoMinutes": settings.max_video_minutes},
        "courses": [c["name"] for c in courses],
        "courseRecords": [dict(c) for c in courses],
        "materials": [{
            "id": m["id"], "name": m["name"], "course": m["course"],
            "courseId": m["course_id"], "type": m["type"],
            "status": status_label.get(m["status"], m["status"]),
            "date": m["created_at"], "seeded": bool(m["seeded"]),
            "url": f"/api/study/materials/{m['id']}/file",
            "error": m["error"], "pages": m["pages"],
            "videoUrl": m["video_url"], "transcriptSource": m["transcript_source"],
        } for m in materials],
        "topics": [{**json.loads(t["data"]), "dbId": t["id"],
                    "mastery": t["mastery"], "attempts": t["attempts"],
                    "correct": t["correct"], "last": t["last"]} for t in topics],
        "attempts": [json.loads(a["data"]) for a in attempts],
        "activity": [a["text"] for a in activity],
        "reviewed": [json.loads(r["data"])["id"] for r in revisions],
    }


@router.post("/bootstrap")
async def bootstrap(request: Request):
    require_csrf(request)
    user = get_user(request)
    db_run(
        "INSERT OR IGNORE INTO profiles(id,name,created_at) VALUES(?,?,?)",
        user.id, user.name[:120], now()
    )
    return _build_state(user.id, user.name)


@router.get("/state")
async def state(request: Request):
    user = get_user(request)
    return _build_state(user.id, user.name)


class ProfileBody(BaseModel):
    name: str
    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not 1 <= len(v) <= 120:
            raise ValueError("Name must be 1–120 characters")
        return v


@router.patch("/profile")
async def update_profile(request: Request, body: ProfileBody):
    require_csrf(request)
    user = get_user(request)
    db_run("UPDATE profiles SET name=? WHERE id=?", body.name, user.id)
    return {"saved": True}


class CourseBody(BaseModel):
    name: str
    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not 1 <= len(v) <= 120:
            raise ValueError("Course name must be 1–120 characters")
        return v


@router.post("/courses", status_code=201)
async def create_course(request: Request, body: CourseBody):
    require_csrf(request)
    user = get_user(request)
    if not db_one("SELECT id FROM profiles WHERE id=?", user.id):
        from fastapi import HTTPException
        raise HTTPException(409, {"error": "Initialize your workspace first.", "code": "profile_required"})
    count = db_one("SELECT count(*) n FROM courses WHERE owner_id=?", user.id)
    if count and count["n"] >= 30:
        from fastapi import HTTPException
        raise HTTPException(409, {"error": "Course limit reached (30).", "code": "quota"})
    if db_one("SELECT id FROM courses WHERE owner_id=? AND lower(name)=lower(?)", user.id, body.name):
        from fastapi import HTTPException
        raise HTTPException(409, {"error": "A course with this name already exists.", "code": "duplicate"})
    cid = new_id()
    db_batch([
        ("INSERT INTO courses(id,owner_id,name,created_at) VALUES(?,?,?,?)", (cid, user.id, body.name, now())),
        ("INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
         (new_id(), user.id, f"Created course {body.name}", now())),
    ])
    return {"id": cid, "name": body.name}


@router.post("/seed")
async def seed(request: Request):
    require_csrf(request)
    user = get_user(request)
    if not db_one("SELECT id FROM profiles WHERE id=?", user.id):
        from fastapi import HTTPException
        raise HTTPException(409, {"error": "Initialize your workspace first.", "code": "profile_required"})
    check_rate(user.id, "seed", settings.rate_limit_seed)

    prefix = hashlib.sha256(user.id.encode()).hexdigest()[:32]
    mid = "notes_" + prefix

    if db_one("SELECT id FROM materials WHERE id=? AND deleted_at IS NULL AND status='ready'", mid):
        return _build_state(user.id, user.name)

    existing_course = db_one(
        "SELECT id FROM courses WHERE owner_id=? AND lower(name)=lower(?)", user.id, "DBMS Unit 1"
    )
    cid = existing_course["id"] if existing_course else ("sample_" + prefix)

    stmts = [
        ("INSERT OR IGNORE INTO courses(id,owner_id,name,created_at) VALUES(?,?,?,?)",
         (cid, user.id, "DBMS Unit 1", now())),
        ("INSERT INTO materials(id,owner_id,course_id,name,type,status,storage_key,bytes,pages,seeded,created_at) "
         "VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,deleted_at=NULL,error=NULL",
         (mid, user.id, cid, "DBMS Unit 1 — Learning notes.txt", "Text", "processing",
          f"{user.id}/{mid}", 4096, 4, 1, now())),
    ]
    for t in INITIAL_TOPICS:
        tid = f"{prefix}_{t['id']}"
        topic_data = json.dumps({**t, "materialId": mid, "sourceTitle": "DBMS learning notes"})
        stmts += [
            ("INSERT OR IGNORE INTO topics(id,owner_id,course_id,name,data,mastery,attempts,correct,last) "
             "VALUES(?,?,?,?,?,0,0,0,'Not practiced')", (tid, user.id, cid, t["name"], topic_data)),
            ("INSERT OR IGNORE INTO flashcards(id,owner_id,topic_id,front,back) VALUES(?,?,?,?,?)",
             (f"{tid}_card", user.id, tid, f"How would you explain {t['name']}?", t["text"])),
        ]
    db_batch(stmts)

    from routes.materials import _save_file
    sample_pages = [t["text"] + "\n\nWorked example\n" + t["example"] for t in INITIAL_TOPICS]
    sample_bytes = "\n\n".join(sample_pages).encode("utf-8")
    _save_file(f"{user.id}/{mid}", sample_bytes)
    db_run("UPDATE materials SET bytes=?,pages=?,name=?,type=? WHERE id=?", len(sample_bytes), len(sample_pages), "DBMS Unit 1 — Learning notes.txt", "Text", mid)
    db_run("DELETE FROM pages WHERE material_id=?", mid)
    add_source(mid, [t["text"] + "\n\nWorked example\n" + t["example"] for t in INITIAL_TOPICS])

    db_batch([
        ("UPDATE materials SET status='ready' WHERE id=?", (mid,)),
        ("INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
         (new_id(), user.id, "Added prepared DBMS learning material", now())),
    ])
    return _build_state(user.id, user.name)
