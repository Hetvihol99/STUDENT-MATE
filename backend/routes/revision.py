"""Revision tracking and flashcard endpoints."""
import json
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, field_validator
from database import db_one, db_all, db_run, db_batch
from auth import get_user, require_csrf
from routes.helpers import new_id, now

router = APIRouter()


class RevisionBody(BaseModel):
    topic: str

    @field_validator("topic")
    @classmethod
    def v(cls, v):
        if not v or len(v) > 160:
            raise ValueError("Topic ID must be 1–160 characters")
        return v


@router.post("/revision")
async def mark_revision(request: Request, body: RevisionBody):
    require_csrf(request)
    user = get_user(request)

    if not db_one("SELECT id FROM profiles WHERE id=?", user.id):
        raise HTTPException(409, {"error": "Initialize your workspace first.", "code": "profile_required"})

    # Accept either the database row id or the logical id stored in the data JSON
    t = db_one(
        "SELECT id FROM topics WHERE owner_id=? AND (id=? OR json_extract(data,'$.id')=?)",
        user.id, body.topic, body.topic
    )
    if not t:
        raise HTTPException(404, {"error": "Topic not found.", "code": "not_found"})

    db_batch([
        ("INSERT INTO revisions(id,owner_id,topic_id,created_at) VALUES(?,?,?,?)",
         (new_id(), user.id, t["id"], now())),
        ("INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
         (new_id(), user.id, "Reviewed a flashcard", now())),
    ])
    return {"saved": True}


@router.get("/flashcards")
async def list_flashcards(request: Request):
    user = get_user(request)
    rows = db_all(
        "SELECT f.id,f.front,f.back,t.data "
        "FROM flashcards f JOIN topics t ON t.id=f.topic_id "
        "WHERE f.owner_id=?",
        user.id
    )
    return [{"id": r["id"], "front": r["front"], "back": r["back"], "data": r["data"]} for r in rows]
