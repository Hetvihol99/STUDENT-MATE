"""Conversations and AI tutor chat endpoints."""
import json
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from database import db_one, db_all, db_run, db_batch
from auth import get_user, require_csrf
from config import settings
from services.retrieval import retrieve
from services.gemini import generate, verify_citations
from routes.helpers import new_id, now, check_rate, owned_course, owned_material, get_evidence

router = APIRouter()

CHAT_SCHEMA = {"type": "object", "required": ["answer", "supported", "citations"], "properties": {
    "answer": {"type": "string"}, "supported": {"type": "boolean"},
    "citations": {"type": "array", "maxItems": 20, "items": {"type": "object", "required": ["id", "quote"], "properties": {
        "id": {"type": "string"}, "quote": {"type": "string", "minLength": 5, "maxLength": 1200},
    }}},
}}



@router.get("/conversations")
async def list_conversations(request: Request):
    user = get_user(request)
    convs = db_all(
        "SELECT conv.*,c.name AS course FROM conversations conv "
        "JOIN courses c ON c.id=conv.course_id "
        "WHERE conv.owner_id=? ORDER BY conv.created_at DESC LIMIT 50",
        user.id
    )
    result = []
    for conv in convs:
        msgs = db_all(
            "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at,rowid",
            conv["id"]
        )
        result.append({
            "id": conv["id"],
            "title": conv["title"],
            "courseId": conv["course_id"],
            "course": conv["course"],
            "messages": [{
                "id": m["id"], "role": m["role"], "text": m["text"],
                **json.loads(m["citations"]),
            } for m in msgs],
        })
    return result


@router.delete("/conversations/{cid}")
async def delete_conversation(cid: str, request: Request):
    require_csrf(request)
    user = get_user(request)
    conv = db_one(
        "SELECT id FROM conversations WHERE owner_id=? AND id=?", user.id, cid
    )
    if not conv:
        raise HTTPException(404, {"error": "Conversation not found.", "code": "not_found"})
    db_run("DELETE FROM conversations WHERE id=? AND owner_id=?", conv["id"], user.id)
    return {"deleted": True}


class ChatBody(BaseModel):
    course: str
    materialId: str
    conversationId: Optional[str] = None
    question: str
    style: Literal["Simple", "Step-by-step", "Exam-focused", "With examples"]

    @field_validator("course")
    @classmethod
    def v_course(cls, v):
        v = v.strip()
        if not 1 <= len(v) <= 120:
            raise ValueError("Course name must be 1–120 characters")
        return v

    @field_validator("question")
    @classmethod
    def v_question(cls, v):
        v = v.strip()
        if not 1 <= len(v) <= 2000:
            raise ValueError("Question must be 1–2000 characters")
        return v

    @field_validator("materialId", "conversationId")
    @classmethod
    def v_id(cls, v):
        if v is not None and len(v) > 160:
            raise ValueError("ID too long")
        return v


@router.post("/chat")
async def chat(request: Request, body: ChatBody):
    require_csrf(request)
    user = get_user(request)

    if not db_one("SELECT id FROM profiles WHERE id=?", user.id):
        raise HTTPException(409, {"error": "Initialize your workspace first.", "code": "profile_required"})

    check_rate(user.id, "chat", settings.rate_limit_chat)

    c = owned_course(user.id, body.course)
    m = owned_material(user.id, body.materialId)

    if m["course_id"] != c["id"] or m["status"] != "ready":
        raise HTTPException(409, {"error": "Choose a ready material from this course.", "code": "not_ready"})

    if body.conversationId:
        if not db_one(
            "SELECT id FROM conversations WHERE id=? AND owner_id=? AND course_id=?",
            body.conversationId, user.id, c["id"]
        ):
            raise HTTPException(404, {"error": "Conversation not found in this course.", "code": "not_found"})

    if not settings.ai_available:
        raise HTTPException(503, {
            "error": (
                "AI is unavailable until GEMINI_API_KEY and GEMINI_MODEL are configured. "
                "Your question has not been submitted to a provider."
            ),
            "code": "ai_unavailable",
        })

    all_evidence = get_evidence(user.id, c["id"], m["id"])
    passages = retrieve(body.question, all_evidence)

    answer = "I could not find support for that in your materials"
    refs: list = []
    support = "none"

    if passages:
        out = await generate({
            "task": (
                "Answer the student in the requested style. If not supported, return "
                'supported:false, answer:"I could not find support for that in your materials", citations:[].'
                " If supported, every material claim must have an exact supporting quote and source id. "
                "Output {answer,supported,citations:[{id,quote}]}."
            ),
            "question": body.question,
            "style": body.style,
            "sources": passages,
        }, response_schema=CHAT_SCHEMA)

        # Validate structure
        if (not isinstance(out, dict) or not isinstance(out.get("answer"), str)
                or not out["answer"].strip() or len(out["answer"]) > 10000
                or not isinstance(out.get("supported"), bool)):
            raise HTTPException(502, {"error": "AI returned an unreadable structure. Retry.", "code": "validation"})

        if out.get("supported"):
            citations = out.get("citations") or []
            if not citations:
                raise HTTPException(502, {"error": "The answer did not include verifiable evidence. Retry.", "code": "missing_evidence"})
            refs = verify_citations(citations, passages)
            answer = str(out["answer"])[:10000]
            support = "supported"

    message_id = new_id()
    conv_id = body.conversationId
    stmts = []

    if not conv_id:
        conv_id = new_id()
        stmts.append((
            "INSERT INTO conversations(id,owner_id,course_id,title,created_at) VALUES(?,?,?,?,?)",
            (conv_id, user.id, c["id"], body.question[:80], now())
        ))

    stmts += [
        ("INSERT INTO messages(id,conversation_id,role,text,citations,created_at) VALUES(?,?,?,?,?,?)",
         (new_id(), conv_id, "student", body.question, "{}", now())),
        ("INSERT INTO messages(id,conversation_id,role,text,citations,created_at) VALUES(?,?,?,?,?,?)",
         (message_id, conv_id, "tutor", answer,
          json.dumps({"evidence": support, "sources": refs}), now())),
        ("INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
         (new_id(), user.id, "Asked a source-grounded tutor question", now())),
    ]
    db_batch(stmts)

    return {
        "conversationId": conv_id,
        "id": message_id,
        "role": "tutor",
        "text": answer,
        "evidence": support,
        "sources": refs,
    }
