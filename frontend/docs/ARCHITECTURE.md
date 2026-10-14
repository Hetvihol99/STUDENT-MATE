# Architecture

The recovered StudyMate source used React and Vinext's App Router compatibility on a Cloudflare Worker. The package keeps that architecture and the original UI styling. Hash navigation selects the learning screens; `lib/api-client.ts` sends same-origin requests to `/api/study/*` and displays server errors.

## Request and learning flow

1. `app/chatgpt-auth.ts` reads the trusted Sites user identifier and email headers. `app/api/study/[[...path]]/route.ts` passes the derived identity to `server/application.ts`. Anonymous access is rejected before storage access. Identity never comes from JSON/body fields.
2. Bootstrap creates a profile. Courses, materials and all learning records carry ownership. All user-facing reads and writes first authorize their parent course/material/conversation/quiz. Mutations require the application origin and custom request header, with cross-site requests rejected.
3. Upload stores a private object in R2 and a `processing` record in D1. The server extracts PDF text with unpdf/PDF.js or validates UTF-8 text. Pages and overlapping ~2,000-character chunks are saved, then status becomes `ready`. Exceptions leave an explicit failed record. There is no simulated progress timer.
4. The tutor searches only a selected, owned, ready material. Bounded keyword overlap selects up to six chunks from at most 500 candidates. This is lexical retrieval, not vector/semantic search. Gemini receives the question, style, source IDs and excerpts, with instructions to treat source content as untrusted evidence.
5. Structured JSON is validated and source IDs/exact quotes checked. No matching evidence produces a refusal; unsupported provider output is not saved as a supported answer. A verified literal quote does **not** prove that the whole answer follows from it. Conversation history is persisted but past turns are not included in the current model prompt.
6. Prepared sample quizzes or configured AI generation create server-held questions. Answer keys and explanations are omitted until submission. MCQ/numeric/short-term grading runs server-side. Each quiz allows one attempt, with an idempotent retry returning the same saved result.
7. Attempt, topic estimate and mastery-history writes use one D1 batch. The documented estimate is `round(0.7 × previous + 0.3 × current topic accuracy)`, starting at zero. It is a study heuristic, not validated mastery measurement.
8. Source-based recall cards and review events support revision. Uploaded materials have a document-level topic/excerpt card; only sample DBMS topics have authored prerequisites and worked examples. The on-screen exam plan is a local suggestion and is not saved or scheduled.

## Storage and deletion

D1 stores profiles and relational learning records. R2 stores private originals; the file endpoint authorizes the owner before streaming. No public bucket URL is returned. In local-only development, SQLite and a private disk directory implement the same application storage interfaces.

Deletion first marks a source `deleting`, excludes it from retrieval, removes its object, then removes pages/chunks, quizzes/attempts/history, cards/reviews/topics. It also deletes all conversations in the course to avoid retaining quoted material. The material tombstone retains metadata (name, size, dates and storage key), not extracted source content. Activity text may still contain material names. A failed delete can be retried. There is no account-wide erasure endpoint in this edition.

## Authentication boundary

Hosted builds rely on Sites dispatch stripping and injecting authenticated identity headers. They must not be deployed as a direct, publicly reachable worker that trusts caller headers. `build/sites-vite-plugin.ts` implements loopback-only mock auth exclusively in Vite `configureServer`; it is absent from production request handling. The separate `dev:local` runner also binds only to 127.0.0.1, checks Host/socket origin, strips spoofed identity headers and uses one development cookie/identity. Neither mechanism is a production account system.

## Limits and reliability

Uploads: 5 MB, PDF ≤25 pages, extracted UTF-8 text ≤80,000 characters. Source processing is synchronous. User quotas: 30 courses, 50 undeleted materials; hourly ceilings: 10 uploads, 10 sample loads, 30 tutor requests, 20 quiz generations. Quiz count 1–10; mock exam 10 minutes plus a 30-second server submission grace. AI calls time out after 25 seconds. The original is stored before extraction; a failure retains the object until deletion. Heavy/complex PDFs may still exceed Worker CPU/memory limits. Production load, retries, monitoring, OCR, vector indexing and automated AI-quality evaluation remain future work.

The `local/` folder is development infrastructure, not a second application or an alternate hosted backend. The hosted build uses D1/R2 unchanged. `npm run check:local` validates the adapter over HTTP; it does not establish D1/R2 or hosted identity behavior.
