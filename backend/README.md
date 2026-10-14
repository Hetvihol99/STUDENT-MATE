# StudyMate AI — account and learning API

FastAPI backend with private SQLite storage, Argon2id password hashes, server-side sessions, PDF/text extraction, source-grounded Gemini tutoring and saved quiz progress.

## Run the complete app

From the project root, prepare Python once:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Only copy the example if you do not already have .env:
cp .env.example .env
```

Set the optional Gemini key and model in `backend/.env`. Then, from `frontend/`:

```bash
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** and choose **Create account**. The local runner starts Python automatically and proxies `/api/study` on the same origin. It forces session authentication and never accepts a development identity. `STUDYMATE_PYTHON` can select another installed Python interpreter with the required packages.

To run the API independently, from `backend/`:

```bash
uvicorn main:app --host 127.0.0.1 --port 8001
```

Interactive API docs are at `/docs`. `/health` reports configuration presence; `/ready` checks database access.

## Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/study/auth/config` | Client authentication provider |
| POST | `/api/study/auth/register` | Create account: name, email, password |
| POST | `/api/study/auth/login` | Authenticate with email and password |
| GET | `/api/study/auth/me` | Current account |
| POST | `/api/study/auth/logout` | Revoke the current session |
| POST | `/api/study/auth/password` | Change password; revoke other sessions |

Registration requires a password of 12–128 characters. Passwords use Argon2id (19 MiB memory, two iterations, one lane). Random session tokens are delivered through HttpOnly, SameSite=Lax cookies; only their SHA-256 digests are stored. Sessions expire after seven days by default. Login attempts are limited by account and network address. Password changes require the current password.

For public deployment, set `APP_ENV=production`, serve through HTTPS, and configure exact `CORS_ORIGINS`. Production cookies require HTTPS. Keep the API and frontend on one origin with a reverse proxy; do not forward anonymous identity headers as authenticated users. Preserve the database and file volume across restarts. The Cloudflare Worker edition uses Sites' trusted ChatGPT identity instead of these Python accounts.

Email verification and emailed password recovery are not implemented. Basic account login requires no external identity provider or API key. Email delivery would require configuring a separate email service if those features are added later.

`AUTH_MODE=session` is the default. `AUTH_MODE=development` explicitly enables test identity headers only when `APP_ENV=development`; production never accepts them. Existing development-student data remains in its original profile and is not automatically attached to a new account.

Every mutation requires `X-StudyMate-Request: 1`. Requests with an Origin must match the app origin or an exact allowed origin; cross-site browser mutations are rejected. JSON bodies are capped at 32 KiB. Multipart bodies are capped at the upload limit plus 64 KiB of form overhead.

## Learning API

All endpoints are under `/api/study` and require an authenticated session:

- `POST /bootstrap`, `GET /state`, `PATCH /profile`, `POST /courses`, `POST /seed`
- `POST /materials`, `GET /materials/{id}/file`, `GET /materials/{id}/pages?page=N`, `PATCH /materials/{id}`, `DELETE /materials/{id}`
- `GET /conversations`, `DELETE /conversations/{id}`, `POST /chat`
- `POST /quizzes`, `POST /quizzes/{id}/submit`
- `POST /revision`, `GET /flashcards`

Text-based PDF, UTF-8 TXT, Markdown, MP4, M4V, WebM and MOV uploads are supported. Public YouTube lessons can be added through `POST /materials/youtube`. Scanned PDFs require OCR, which is not included. Prepared practice needs no Gemini key. AI features verify source quotes but do not independently prove every generated claim or answer.

## Storage and configuration

Relative paths always resolve under `backend/`, regardless of the launch directory.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | empty | Optional Gemini provider credential |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Model identifier |
| `APP_ENV` | `development` | Production enables Secure cookies |
| `AUTH_MODE` | `session` | Real account sessions; development opt-in for tests |
| `SESSION_DAYS` | `7` | Session lifetime; 1–30 days |
| `DATABASE_PATH` | `.local-data/studymate.db` | SQLite database |
| `STORAGE_PATH` | `.local-data/files` | Private originals |
| `MAX_UPLOAD_MB` | `5` | Maximum document size |
| `MAX_VIDEO_MB` | `50` | Maximum video size |
| `MAX_VIDEO_MINUTES` | `60` | Recommended maximum lesson duration and timestamp bound |
| `VIDEO_TIMEOUT_SECONDS` | `180` | Video provider processing timeout |
| `MAX_PDF_PAGES` | `25` | PDF page limit |
| `MAX_TEXT_CHARS` | `80000` | Extracted text limit |
| `CORS_ORIGINS` | localhost development origins | Exact allowed origins |

SQLite requires no database API key. Supabase is not integrated. Keep `.env`, `.local-data`, sessions and uploaded files out of source control and shared packages.

## Verification

From the project root:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
backend/.venv/bin/python -m pip check
cd frontend
npm run typecheck
npm test
npm run check:local
```

The HTTP smoke check uses port 5174 and a disposable temporary database, disables Gemini calls, and removes its test data. The separate TypeScript backend under `frontend/server/` has its own tests and D1/R2 storage. It does not share the Python database.

## Video and YouTube material

In Upload Material, choose **Video upload** or **YouTube link**. Video imports extract chronological study-text sections and create topics and flashcards for them. Source panels include a player, section navigation and timestamps. Uploaded video files support authenticated byte-range playback.

Automatic extraction uses the same Gemini key as tutoring; no YouTube API key is needed. It sends the uploaded video or the canonical public YouTube URL to Gemini. Temporary provider files are deleted after extraction; the original uploaded file stays in your private local storage. Public links are restricted to canonical YouTube video IDs; arbitrary URLs and playlists are rejected.

If extraction is unavailable, expand **Have a transcript? Paste it instead** and provide the spoken lesson text or accurate notes. The supplied transcript becomes the study source, without a video extraction request. AI-generated transcripts can omit or misread content; verify them against the original before relying on generated quizzes or tutoring. Long or inaccessible videos may require a shorter clip or a pasted transcript.

Source document topics now start on the first readable page, so blank PDF cover pages do not create empty practice topics. AI quizzes use provider-enforced response schemas, and non-MCQ questions never include option arrays in the public response.

Restart the app after backend changes. Existing SQLite databases receive the additive `material_media` table automatically; prior account and learning data is preserved.
