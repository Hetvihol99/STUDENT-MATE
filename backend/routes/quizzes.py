"""Quiz generation and submission endpoints."""
import json, math
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, field_validator
from database import db_one, db_all, db_run, db_batch
from auth import get_user, require_csrf
from config import settings
from services.grading import grade
from services.gemini import generate, verify_citations
from services.curriculum import select_questions
from routes.helpers import new_id, now, check_rate, owned_course, owned_material, get_evidence

router = APIRouter()

QUESTION_SCHEMA = {
    "type": "object",
    "required": ["type", "difficulty", "prompt", "answer", "explanation", "citation", "aliases", "options"],
    "properties": {
        "type": {"type": "string", "enum": ["MCQ", "Short answer", "Numerical"]},
        "difficulty": {"type": "string", "enum": ["Easy", "Medium"]},
        "prompt": {"type": "string", "minLength": 5, "maxLength": 1500}, "answer": {"type": "string", "minLength": 1, "maxLength": 500, "description": "For MCQ, exactly copy the full text of the correct option; never an option letter or index. For Numerical, use a finite number as a string."},
        "aliases": {"type": "array", "items": {"type": "string"}},
        "options": {"type": "array", "items": {"type": "string"}},
        "explanation": {"type": "string", "minLength": 5, "maxLength": 1500},
        "citation": {"type": "object", "required": ["id", "quote"], "properties": {
            "id": {"type": "string"}, "quote": {"type": "string", "minLength": 5, "maxLength": 1200},
        }},
    },
}


def quiz_schema(count: int, question_type: str, difficulty: str) -> dict:
    import copy
    question = copy.deepcopy(QUESTION_SCHEMA)
    if question_type != "Mixed":
        question["properties"]["type"]["enum"] = [question_type]
    if difficulty != "Adaptive":
        question["properties"]["difficulty"]["enum"] = [difficulty]
    return {"type": "object", "required": ["questions"], "properties": {
        "questions": {"type": "array", "minItems": count, "maxItems": count, "items": question},
    }}


def citation_catalog(evidence: list) -> list[dict]:
    """Offer bounded, exact source excerpts; the model only selects an ID."""
    catalog = []
    for source in evidence:
        for ordinal, offset in enumerate(range(0, len(source["text"]), 900)):
            quote = source["text"][offset:offset + 900].strip()
            if len(quote) < 5:
                continue
            catalog.append({"id": source["id"] if ordinal == 0 else f"{source['id']}_excerpt_{ordinal}",
                            "sourceId": source["id"], "page": source["page"], "text": quote})
    return catalog


def resolve_citation(question: dict, catalog: list[dict]) -> dict:
    q = dict(question)
    citation = q.get("citation")
    if not isinstance(citation, dict):
        return q
    selected = next((entry for entry in catalog if entry["id"] == citation.get("id")), None)
    if selected:
        # Legacy/provider-supplied quotes still go through strict verification.
        # New responses choose an ID, and the server supplies the exact excerpt.
        q["citation"] = {"id": selected["sourceId"], "quote": citation.get("quote", selected["text"])}
    return q


def normalize_question(raw):
    if not isinstance(raw, dict):
        return raw
    q = dict(raw)
    q["type"] = {"Multiple Choice": "MCQ", "Multiple choice": "MCQ", "Short Answer": "Short answer"}.get(q.get("type"), q.get("type"))
    if q.get("aliases") is None:
        q["aliases"] = []
    if q.get("type") != "MCQ":
        q.pop("options", None)
    if q.get("type") == "Numerical" and isinstance(q.get("answer"), (int, float)) and not isinstance(q["answer"], bool):
        q["answer"] = str(q["answer"])
    return q


def _validate_ai_question(q: dict, requested_type: str, requested_diff: str, evidence: list) -> dict:
    """Validate a single AI-generated question. Raises HTTPException on any issue."""
    if (not isinstance(q, dict) or q.get("type") not in ("MCQ", "Short answer", "Numerical")
            or q.get("difficulty") not in ("Easy", "Medium")
            or any(not isinstance(q.get(field), str) or not q[field].strip() or len(q[field]) > 10000
                   for field in ("prompt", "answer", "explanation"))
            or not isinstance(q.get("aliases", []), list)
            or any(not isinstance(a, str) or not a.strip() for a in q.get("aliases", []))):
        raise HTTPException(502, {"error": "The generated quiz was incomplete. Try fewer questions or a different question type.", "code": "invalid_question"})
    if requested_type != "Mixed" and q.get("type") != requested_type:
        raise HTTPException(502, {"error": "AI question type did not match the request.", "code": "question_type"})
    if requested_diff != "Adaptive" and q.get("difficulty") != requested_diff:
        raise HTTPException(502, {"error": "AI difficulty did not match the request.", "code": "difficulty"})
    if q.get("type") == "MCQ":
        options = q.get("options") or []
        answer = q.get("answer", "")
        if (not isinstance(options, list) or not 2 <= len(options) <= 6
                or any(not isinstance(o, str) or not o.strip() for o in options)
                or answer not in options or len(set(options)) != len(options)):
            raise HTTPException(502, {"error": "AI answer key could not be validated.", "code": "invalid_key"})
    if q.get("type") == "Numerical":
        try:
            val = float(q.get("answer", ""))
            if not math.isfinite(val):
                raise ValueError
        except (ValueError, TypeError):
            raise HTTPException(502, {"error": "AI numerical key is invalid.", "code": "invalid_key"})
    # verify citation
    citation = q.get("citation") or {}
    ref = verify_citations([citation], evidence)
    return ref[0]


class QuizBody(BaseModel):
    course: str
    materialId: str
    topic: str
    type: Literal["Mixed", "MCQ", "Short answer", "Numerical"]
    difficulty: Literal["Adaptive", "Easy", "Medium"]
    count: int
    mode: Literal["Practice quiz", "Mock exam"]
    source: Literal["prepared", "ai"]

    @field_validator("count")
    @classmethod
    def v_count(cls, v):
        if not 1 <= v <= 10:
            raise ValueError("Count must be 1–10")
        return v

    @field_validator("topic")
    @classmethod
    def v_topic(cls, v):
        if len(v) > 160:
            raise ValueError("Topic too long")
        return v


@router.post("/quizzes", status_code=201)
async def create_quiz(request: Request, body: QuizBody):
    require_csrf(request)
    user = get_user(request)

    if not db_one("SELECT id FROM profiles WHERE id=?", user.id):
        raise HTTPException(409, {"error": "Initialize your workspace first.", "code": "profile_required"})

    check_rate(user.id, "quiz", settings.rate_limit_quiz)
    c = owned_course(user.id, body.course)
    m = owned_material(user.id, body.materialId)

    if m["course_id"] != c["id"] or m["status"] != "ready":
        raise HTTPException(409, {"error": "Choose a ready material from this course.", "code": "not_ready"})

    topics = db_all("SELECT * FROM topics WHERE owner_id=? AND course_id=?", user.id, c["id"])

    qs: list[dict] = []
    verification = "Prepared source-linked answer key"
    repeated = False

    # ── PREPARED SOURCE ──
    if body.source == "prepared":
        if not m["seeded"]:
            raise HTTPException(409, {
                "error": "Prepared questions are only available for DBMS learning notes. Choose AI generation for your own material.",
                "code": "prepared_only",
            })
        prev_attempts = db_all(
            "SELECT a.data FROM attempts a JOIN quizzes q ON q.id=a.quiz_id "
            "WHERE a.owner_id=? AND q.material_id=? ORDER BY a.created_at DESC LIMIT 50",
            user.id, m["id"]
        )
        seen = [
            q2["bankId"]
            for a in prev_attempts
            for q2 in json.loads(a["data"]).get("questions", [])
            if q2.get("bankId")
        ]
        selected = select_questions(body.topic, body.type, body.difficulty, body.count, seen)
        if not selected:
            raise HTTPException(422, {"error": "No prepared questions match these filters.", "code": "no_questions"})
        repeated = any(q2["id"] in seen for q2 in selected)
        qs = [{**q2, "bankId": q2["id"], "id": new_id(), "materialId": m["id"], "sourceTitle": m["name"]} for q2 in selected]

    # ── AI SOURCE ──
    else:
        if not settings.ai_available:
            raise HTTPException(503, {
                "error": "AI is unavailable until GEMINI_API_KEY and GEMINI_MODEL are configured.",
                "code": "ai_unavailable",
            })
        passages = get_evidence(user.id, c["id"], m["id"])
        if not passages:
            raise HTTPException(409, {"error": "There is no extracted text for this material.", "code": "no_evidence"})

        chosen_topic = next(
            (t for t in topics
             if json.loads(t["data"]).get("id") == body.topic
             and json.loads(t["data"]).get("materialId") == m["id"]),
            None
        )
        if body.topic != "all" and not chosen_topic:
            raise HTTPException(422, {"error": "Select a topic belonging to this material.", "code": "topic_scope"})

        # The single topic created for an uploaded document represents the whole file.
        document_topic = chosen_topic and not m["seeded"] and m["type"] in ("PDF", "Text")
        page_filter = json.loads(chosen_topic["data"]).get("page") if chosen_topic and not document_topic else None
        subset = [p for p in passages if p["page"] == page_filter] if page_filter else passages
        if len(subset) > 12:
            subset = [subset[round(i * (len(subset) - 1) / 11)] for i in range(12)]
        catalog = citation_catalog(subset)
        if not catalog:
            raise HTTPException(409, {"error": "This material does not contain enough readable text for a quiz.", "code": "no_evidence"})
        schema = quiz_schema(body.count, body.type, body.difficulty)
        schema["properties"]["questions"]["items"]["properties"]["citation"] = {
            "type": "object", "required": ["id"], "additionalProperties": False,
            "properties": {"id": {"type": "string", "enum": [entry["id"] for entry in catalog]}},
        }

        generated = await generate({
            "task": (
                "Generate a quiz using only these sources. "
                "Return {questions:[{type,difficulty,prompt,answer,aliases,options,explanation,citation:{id}}]}. "
                "MCQ answer must exactly match one option; numerical answer must be a finite number string. "
                "No duplicates. Choose the ID of the source excerpt supporting each answer. Do not generate a quote; the server will attach the exact source text."
            ),
            "count": body.count,
            "type": body.type,
            "difficulty": body.difficulty,
            "sources": [{"id": entry["id"], "page": entry["page"], "text": entry["text"]} for entry in catalog],
            "rules": "Use only types MCQ, Short answer, Numerical, and difficulty Easy or Medium. For non-MCQ questions return options:[], and aliases:[] when no alternatives exist. Every answer is a string. Never use True/False as a question type. Each citation must select one supplied excerpt ID. Do not retype, reformat or invent source quotations.",
        }, response_schema=schema)

        if not isinstance(generated, dict) or not isinstance(generated.get("questions"), list):
            raise HTTPException(502, {"error": "AI quiz structure is invalid.", "code": "invalid_question"})
        raw_qs = generated["questions"]
        if len(raw_qs) != body.count:
            raise HTTPException(502, {"error": "AI generated an unexpected question count. Retry.", "code": "question_count"})

        for original in raw_qs:
            raw_q = normalize_question(original)
            if isinstance(raw_q, dict):
                raw_q = resolve_citation(raw_q, catalog)
            ref = _validate_ai_question(raw_q, body.type, body.difficulty, subset)
            matched_topic = (
                chosen_topic or
                next((t for t in topics if json.loads(t["data"]).get("materialId") == m["id"] and json.loads(t["data"]).get("page") == ref["page"]), None) or
                next((t for t in topics if json.loads(t["data"]).get("materialId") == m["id"]), None)
            )
            topic_id = json.loads(matched_topic["data"]).get("id", m["id"]) if matched_topic else m["id"]
            qs.append({**raw_q, "id": new_id(), "topic": topic_id, "page": ref["page"], "materialId": m["id"], "sourceTitle": m["name"]})

        prompts = [q["prompt"].lower() for q in qs]
        if len(set(prompts)) != len(prompts):
            raise HTTPException(502, {"error": "Duplicate questions were generated. Retry.", "code": "duplicates"})

        verification = "AI generated; schema and source quote checked, answer correctness not independently verified"

    # ── PERSIST QUIZ ──
    qid = new_id()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat() if body.mode == "Mock exam" else None
    stmts = [(
        "INSERT INTO quizzes(id,owner_id,course_id,material_id,mode,verification,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
        (qid, user.id, c["id"], m["id"], body.mode, verification, now(), expires)
    )]

    for i, q in enumerate(qs):
        t = next(
            (t for t in topics if json.loads(t["data"]).get("id") == q.get("topic")
             and json.loads(t["data"]).get("materialId") == m["id"]),
            next((t for t in topics if json.loads(t["data"]).get("materialId") == m["id"]), None)
        )
        if not t:
            raise HTTPException(409, {"error": "No topic exists for this source.", "code": "topic_missing"})
        stmts.append((
            "INSERT INTO questions(id,quiz_id,topic_id,ordinal,data) VALUES(?,?,?,?,?)",
            (q["id"], qid, t["id"], i, json.dumps(q))
        ))

    db_batch(stmts)

    # Return questions without answer/explanation/citation
    public_qs = [
        {k: v for k, v in q.items() if k not in ("answer", "aliases", "explanation", "citation")}
        for q in qs
    ]
    return {"id": qid, "questions": public_qs, "verification": verification, "repeated": repeated, "expiresAt": expires}


class SubmitBody(BaseModel):
    answers: dict[str, str]

    @field_validator("answers")
    @classmethod
    def v_answers(cls, v):
        for val in v.values():
            if len(val) > 1000:
                raise ValueError("Answer too long")
        return v


@router.post("/quizzes/{qid}/submit")
async def submit_quiz(qid: str, request: Request, body: SubmitBody):
    require_csrf(request)
    user = get_user(request)

    quiz = db_one("SELECT * FROM quizzes WHERE id=? AND owner_id=?", qid, user.id)
    if not quiz:
        raise HTTPException(404, {"error": "Quiz not found.", "code": "not_found"})

    # Idempotent — return existing attempt
    prior = db_one("SELECT data FROM attempts WHERE quiz_id=? AND owner_id=?", qid, user.id)
    if prior:
        return json.loads(prior["data"])

    records = db_all("SELECT * FROM questions WHERE quiz_id=? ORDER BY ordinal", qid)
    all_qs = [json.loads(r["data"]) for r in records]
    q_ids = {q["id"] for q in all_qs}

    unknown = [k for k in body.answers if k not in q_ids]
    if unknown:
        raise HTTPException(400, {"error": "An answer refers to a question outside this assessment.", "code": "unknown_question"})

    # Mock exam expiry check
    if quiz["expires_at"]:
        exp = datetime.fromisoformat(quiz["expires_at"].replace("Z", "+00:00"))
        grace = exp + timedelta(seconds=30)
        if datetime.now(timezone.utc) > grace:
            raise HTTPException(409, {"error": "The mock exam submission window has expired.", "code": "exam_expired"})

    results = [grade(q, body.answers.get(q["id"], "")) for q in all_qs]
    aid = new_id()
    date = now()
    score = round(sum(results) / len(all_qs) * 100) if all_qs else 0
    attempt = {
        "id": aid, "quizId": qid, "date": date,
        "questions": all_qs, "answers": body.answers,
        "results": results, "score": score,
    }

    stmts = [(
        "INSERT INTO attempts(id,quiz_id,owner_id,score,data,created_at) VALUES(?,?,?,?,?,?)",
        (aid, qid, user.id, score, json.dumps(attempt), date)
    )]

    # Update mastery per topic
    topic_ids = list({r["topic_id"] for r in records})
    for tid in topic_ids:
        indices = [i for i, r in enumerate(records) if r["topic_id"] == tid]
        correct_count = sum(1 for i in indices if results[i])
        accuracy = (correct_count / len(indices)) * 100
        stmts += [
            ("UPDATE topics SET mastery=CAST(ROUND(0.7*mastery+0.3*?) AS INTEGER),"
             "attempts=attempts+?,correct=correct+?,last=? WHERE id=? AND owner_id=?",
             (accuracy, len(indices), correct_count, date, tid, user.id)),
            ("INSERT INTO mastery_history(id,owner_id,topic_id,attempt_id,mastery,created_at) "
             "SELECT ?,owner_id,id,?,mastery,? FROM topics WHERE id=? AND owner_id=?",
             (new_id(), aid, date, tid, user.id)),
        ]

    stmts.append((
        "INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
        (new_id(), user.id, f"Completed a quiz · {score}%", date)
    ))

    try:
        db_batch(stmts)
    except Exception:
        saved = db_one("SELECT data FROM attempts WHERE quiz_id=? AND owner_id=?", qid, user.id)
        if saved:
            return json.loads(saved["data"])
        raise

    return attempt
