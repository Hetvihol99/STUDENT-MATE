# API

Base: `/api/study`. Hosted requests need authenticated Sites identity; owner IDs are never accepted from clients. Browser requests use same-origin credentials. Every non-GET request requires `Origin` equal to the request URL origin and `X-StudyMate-Request: 1`; `Sec-Fetch-Site: cross-site` is rejected. JSON objects use strict validation where documented. Responses are private/no-store.

Call `POST /bootstrap {}` after sign-in. IDs below are server-returned opaque identifiers. `course` accepts an owned course name or ID. All endpoints require configured `DB` and `BUCKET` bindings even when a particular operation does not use both.

| Method/path | Input | Success |
| --- | --- | --- |
| POST `/bootstrap` | `{}` | Current workspace; idempotently creates profile |
| GET `/state` | none | `{user:{name},aiAvailable,courses,courseRecords,materials,topics,attempts,activity,reviewed}`; latest 100 attempts, 30 activities |
| PATCH `/profile` | `{name}` 1–120 trimmed chars | `{saved:true}` |
| POST `/courses` | `{name}` 1–120 chars | 201 `{id,name}`; duplicate names rejected |
| POST `/seed` | `{}` | State after loading sample into current owner; safe to repeat while ready |
| POST `/materials` | Multipart `course`, `file` | 201 `{id,status:'ready',pages}`; failed extraction returns error + `materialId` |
| GET `/materials/:id/file` | none | Authorized original PDF/text with nosniff and restrictive sandbox CSP |
| GET `/materials/:id/pages?page=N` | Integer page 1–25 | `{page,text,title,materialId}` for a ready source |
| PATCH `/materials/:id` | `{name}` 1–120 chars | `{saved:true}` |
| DELETE `/materials/:id` | none | `{deleted:true}`; related learning records and course chats removed |
| GET `/conversations` | none | Up to 50 conversations, each with ordered messages and checked source references |
| DELETE `/conversations/:id` | none | `{deleted:true}` |
| POST `/chat` | `{course,materialId,conversationId?,question,style}` | `{conversationId,id,role:'tutor',text,evidence,sources}` |
| POST `/quizzes` | Configuration below | 201 `{id,questions,verification,repeated,expiresAt}`; keys withheld |
| POST `/quizzes/:id/submit` | `{answers:{questionId:'answer'}}` | Saved attempt with `id,quizId,date,questions,answers,results,score`; answer keys now included |
| POST `/revision` | `{topic}` logical topic ID or owned database topic ID | `{saved:true}` |
| GET `/flashcards` | none | Owned cards (`id,front,back,data`); `data` is topic JSON text |

Chat: question 1–2,000 trimmed characters. Styles: `Simple`, `Step-by-step`, `Exam-focused`, `With examples`. The conversation must belong to the selected course. No supporting passages yields `evidence:'none'`; quotes checked against retrieved text yield `evidence:'supported'`. This label is not an independent factuality guarantee.

Quiz configuration:

```json
{
  "course": "DBMS Unit 1",
  "materialId": "USE_RETURNED_MATERIAL_ID",
  "topic": "all",
  "type": "Mixed",
  "difficulty": "Adaptive",
  "count": 5,
  "mode": "Practice quiz",
  "source": "prepared"
}
```

Types: Mixed/MCQ/Short answer/Numerical. Difficulties: Adaptive/Easy/Medium. Modes: Practice quiz/Mock exam. Source: prepared/ai. Count: integer 1–10. Prepared quizzes require the seeded material and may return fewer questions if filters exhaust the bank. AI count/type/difficulty/schema/source-quote validation is enforced; answer correctness is not independently checked. Topic-specific AI generation uses that source topic's page. All-material generation considers the first 12 chunks, so it may omit later content.

Answers are strings up to 1,000 characters. Unknown question IDs are rejected. An expired mock exam rejects submissions after its grace period. Duplicate submissions return the existing attempt and never update mastery twice. Active unsubmitted quizzes are not restored by the UI after a page reload.

## Errors

Errors use `{error: readableMessage, code: stableCategory}`. The client displays the readable message. Status categories:

- 400: malformed JSON/form/fields or unknown question. A provider schema mismatch currently also uses 400 `validation`.
- 401 `unauthenticated`: no trusted identity.
- 403 `origin`: failed mutation-origin/header checks.
- 404 `not_found`/`page_missing`: absent **or not owned**, without revealing another student's records.
- 409: not ready, duplicate, quota, expired exam, missing profile, wrong prepared scope.
- 413: request/file too large; multipart body capped at 5 MB + 64 KB, JSON at 32 KB.
- 415/422: unsupported type, unreadable/scanned/corrupt/encrypted PDF, invalid text, limits or no matching quiz questions.
- 429 `rate_limit`: per-student fixed-hour ceiling.
- 502: AI provider failure, timeout, empty/invalid output or unverifiable quote/key structure.
- 503: AI/configuration/storage unavailable or an unexpected service error.

No secrets, provider response bodies or database stack traces are returned. AI failures do not create a fabricated tutor message. Source upload failures intentionally preserve a visible failed record for inspection/deletion.
