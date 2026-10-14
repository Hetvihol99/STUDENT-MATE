"""Shared helpers used across all route modules."""
import uuid, json
from datetime import datetime, timezone
from database import db_one, db_all, db_run, db_batch, get_db
from fastapi import HTTPException


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def add_event(user_id: str, message: str):
    db_run(
        "INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
        new_id(), user_id, message, now()
    )


def check_rate(user_id: str, bucket: str, limit: int):
    key = f"{user_id}:{bucket}"
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    reset = ts + 3_600_000
    conn = get_db()
    with conn:
        row = conn.execute(
            """INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?)
               ON CONFLICT(key) DO UPDATE SET
                 count = CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,
                 reset_at = CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END
               RETURNING count""",
            (key, reset, ts, ts),
        ).fetchone()
    if row and row["count"] > limit:
        raise HTTPException(429, {
            "error": "Hourly request limit reached. Please try later.",
            "code": "rate_limit",
        })


def owned_course(user_id: str, name_or_id: str):
    c = db_one(
        "SELECT * FROM courses WHERE owner_id=? AND (id=? OR name=?)",
        user_id, name_or_id, name_or_id
    )
    if not c:
        raise HTTPException(404, {"error": "Course not found.", "code": "not_found"})
    return c


def owned_material(user_id: str, mid: str):
    m = db_one(
        "SELECT * FROM materials WHERE id=? AND owner_id=? AND deleted_at IS NULL",
        mid, user_id
    )
    if not m:
        raise HTTPException(404, {"error": "Material not found.", "code": "not_found"})
    return m


def add_source(material_id: str, pages: list[str]):
    """Store page texts and overlapping chunks (2000-char window, 1800 stride)."""
    stmts: list[tuple] = []
    for i, page_text in enumerate(pages):
        pid = new_id()
        stmts.append((
            "INSERT INTO pages(id,material_id,page,text) VALUES(?,?,?,?)",
            (pid, material_id, i + 1, page_text)
        ))
        off = 0
        j = 0
        while off < len(page_text):
            stmts.append((
                "INSERT INTO chunks(id,page_id,ordinal,text) VALUES(?,?,?,?)",
                (new_id(), pid, j, page_text[off:off + 2000])
            ))
            off += 1800
            j += 1
    db_batch(stmts)


def get_evidence(user_id: str, course_id: str, material_id: str | None = None):
    sql = (
        "SELECT ch.id,ch.text,p.page,m.id AS materialId,m.name AS title "
        "FROM chunks ch "
        "JOIN pages p ON p.id=ch.page_id "
        "JOIN materials m ON m.id=p.material_id "
        "WHERE m.owner_id=? AND m.course_id=? AND m.status='ready' AND m.deleted_at IS NULL"
    )
    args = [user_id, course_id]
    if material_id:
        sql += " AND m.id=?"
        args.append(material_id)
    sql += " ORDER BY m.created_at DESC,p.page,ch.ordinal LIMIT 500"
    return [dict(r) for r in db_all(sql, *args)]
