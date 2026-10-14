# 3–5 minute demonstration

## Before the judges arrive

Use Node 24+, run `npm ci`, then `npm run dev:local`. Open http://127.0.0.1:5173. This is a local development identity, not a hosted ChatGPT account. Stop any other runner using port 5173. For the no-credential demonstration, leave both AI values blank. Use only the public sample files in this package.

## 0:00–0:40 — problem and workspace

“Students have notes scattered across files and need a clear path from source material to practice and revision. StudyMate keeps those steps in one workspace.”

Sign in locally. Explain that a fresh student has no fabricated mastery or previous activity. Open Add learning material and load the sample DBMS Unit 1 notes. Show the course/library and a source page.

## 0:40–1:20 — real ingestion

Create a course if desired. Upload `sample-materials/DBMS-small.md`, or the supplied PDF. Open the saved source text and original file. State that text extraction is real; scans, slides and video are intentionally unsupported. A corrupt PDF yields a visible failure, not a simulated success.

## 1:20–2:40 — practice and persistence

Choose the seeded DBMS material, prepared question source, Keys & constraints, and 3 questions. Start practice, answer, and submit. Show explanations/source links and the saved attempt. The server computes the score and updates the topic estimate once. Open progress and refresh: the saved result remains. Estimates use a documented 70/30 formula and are not validated measures of mastery.

## 2:40–3:20 — revision

Open Revision Center, flip a source-based card and mark it reviewed. Refresh and show the saved review. Explain that weak topics drive the suggested practice order. The date-based study plan is a temporary suggestion rather than an external calendar or saved schedule.

## 3:20–4:20 — AI, without overclaiming

Without credentials: ask “What is a primary key?” and show the explicit AI-unavailable message. Explain that prepared practice works without an API account; there is no fabricated AI fallback.

Only if you have configured and verified your own Gemini credentials: ask the question against the sample source, open its exact quote/page, then ask about an unrelated subject and inspect the refusal. Say that quote validation does not guarantee full answer correctness. Do not describe provider-stub tests as real AI calls.

## 4:20–5:00 — technical evidence and boundaries

Show `docs/ARCHITECTURE.md` and `docs/VALIDATION.md`. Explain one combined application, ownership checks, private originals, versioned migrations and a portable ZIP. State the limits: local API journey tested; Worker/hosted identity, live provider and browser visual QA still need validation. The existing live link is the earlier published site and was not updated for this package.
