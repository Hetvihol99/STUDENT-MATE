STUDYMATE AI
PROJECT README AND TECHNOLOGY GUIDE

1. WHAT THE PROJECT DOES

StudyMate AI is a personal study application.
You can organize courses, upload notes, add videos and YouTube lessons,
ask an AI tutor questions, create quizzes, and review your progress.
Each signed-in account has its own saved learning workspace.

2. TECHNOLOGIES AND THEIR USES

MAIN LOCAL APPLICATION

React: Builds the screens and interactive parts of the frontend.
TypeScript: Adds types to the frontend code and helps find coding mistakes.
HTML: Provides the structure of the screens.
CSS: Controls colors, spacing, fonts, layouts and responsive behavior.
Tailwind CSS: Provides utility classes and styling support.
shadcn-style UI components, Radix UI and Base UI: Provide reusable controls,
such as dialogs, sidebars, dropdowns, tabs and progress indicators.
Lucide React: Displays icons.
Recharts: Displays progress and quiz-performance charts.
Sonner: Displays success and error notifications.
Vite: Runs the local frontend and updates it during development.
Node.js: Runs frontend tools and the script that starts both app servers.
npm: Installs frontend packages and runs project commands.

Python: Implements the local backend and learning operations.
FastAPI: Provides the HTTP API used by the frontend.
Uvicorn: Runs the FastAPI server.
Pydantic: Validates incoming data and application settings.
pydantic-settings and python-dotenv: Read configuration from environment
variables and backend/.env.
SQLite: Stores accounts, sessions, courses, material records, extracted text,
conversations, quizzes, attempts, flashcards and progress.
Python sqlite3: Executes database queries and transactions.
Local file storage: Keeps original uploaded documents and videos on disk.
Argon2id through argon2-cffi: Hashes passwords before storage.
HttpOnly session cookies: Keep users signed in without exposing the session
cookie to frontend JavaScript.
Python secrets: Creates random session tokens.
SHA-256 through hashlib: Stores session-token fingerprints instead of raw
session tokens. Passwords use Argon2id, not SHA-256.
HTTPX: Makes server-side requests to Gemini.
python-multipart: Reads file-upload forms.
pdfplumber: Extracts readable text from PDF pages.
pdfminer.six: Supports PDF text extraction underneath pdfplumber.
Google Gemini API: Generates tutor answers and AI quiz questions, and extracts
study text from video uploads and public YouTube videos.
Gemini Files API: Temporarily uploads videos for AI processing.
JSON Schema: Constrains the structure of AI responses.
Keyword retrieval: Finds relevant saved text passages for tutoring.
This is simple text search; a vector database is not used.
Browser video player: Plays uploaded video files.
YouTube embed: Plays public YouTube lessons inside the source panel.

SEPARATE HOSTED APPLICATION SUPPORT

Next.js-style app structure: Organizes pages and hosted API routes.
Vinext: Builds the Next-style application using Vite for the hosted runtime.
Cloudflare Workers: Runs the separate hosted TypeScript backend.
Cloudflare D1: Stores data for the hosted edition.
Cloudflare R2: Stores uploaded files for the hosted edition.
Drizzle ORM and Drizzle Kit: Describe the hosted database and manage migrations.
Wrangler: Builds, runs and manages Cloudflare runtime tooling.
Zod: Validates data in the hosted TypeScript backend.
unpdf: Extracts PDF text in the hosted backend.
Trusted ChatGPT sign-in: Supplies identity to the supported hosted runtime.

The normal local command uses React plus the Python backend and SQLite.
It does not use Cloudflare D1/R2 for local account data.
Local Python accounts and hosted ChatGPT accounts have separate storage.
The hosted backend currently has the document-only material contract.
Video and YouTube study imports are available through the Python backend.

TESTING TOOLS

Python unittest: Tests backend behavior.
FastAPI TestClient: Tests API requests without starting a public server.
Node.js test runner: Tests TypeScript backend and practice-selection behavior.
TypeScript compiler: Checks frontend types.
HTTP smoke-check script: Tests the frontend-to-Python connection.
Vinext/Vite build: Checks that the hosted frontend and server can compile.
Browser checks: Verify representative desktop and mobile interactions.

DESIGN REFERENCE

The interface uses black, white and soft gray, bold headings, rounded cards
and pill-shaped buttons, inspired by the supplied Figma e-commerce template.
Figma is a design reference; it is not required to run the application.

3. CURRENT FEATURES

Accounts:
- Create an account using a name, email and password.
- Sign in and sign out.
- Edit your display name.
- Change your password using your current password.
- Password changes revoke other sessions.
- Sessions expire after seven days by default.

Courses and materials:
- Create courses and organize materials by course.
- Upload PDF, TXT and Markdown documents.
- Upload MP4, M4V, WebM and MOV videos.
- Add public YouTube video links.
- Paste a transcript when automatic video extraction is unavailable.
- View original files and extracted source text.
- Navigate document pages and video study-text sections.
- Play uploaded videos and embedded YouTube lessons.
- Rename and delete materials.
- Search, filter and sort the library.
- Load the prepared DBMS sample dataset.

AI tutor:
- Ask questions about a selected material.
- Choose an explanation style.
- Retrieve relevant passages from your saved text.
- Open supporting source references.
- Save and delete conversations.
- Receive an unsupported-answer response when evidence is insufficient.

Quizzes and practice:
- Use the prepared DBMS question bank or Gemini generation.
- Choose MCQ, short-answer, numerical or mixed questions.
- Choose easy, medium or adaptive difficulty.
- Request up to ten questions through the API.
- Practice a specific topic or the selected material's topics.
- Use practice quizzes or timed mock exams.
- Review answers and explanations after submission.
- Keep answer keys hidden before submission.
- Save an attempt only once, even if submission is repeated.

Progress and revision:
- View quiz results and topic estimates.
- Track recent activity.
- Review flashcards and mark topics as reviewed.
- Export a progress report.

4. HOW THE APP WORKS

The browser shows the React frontend.
The frontend sends requests to /api/study on the same app address.
The local development runner forwards these requests to FastAPI.
FastAPI checks the user's session and ownership of the requested data.
SQLite stores learning records, while uploaded originals stay in local files.

Documents:
Upload -> extract text -> save pages and chunks -> create study topics -> study.

Videos and YouTube:
Upload or add link -> use Gemini extraction or a supplied transcript -> save
study-text sections -> create topics and flashcards -> use the tutor or quizzes.

AI tutoring:
Question -> keyword retrieval -> selected passages sent to Gemini -> validate
response and source quotes -> save conversation.

AI quizzes:
Select material -> choose source excerpts -> request structured questions ->
Gemini selects excerpt IDs -> server attaches exact source text -> validate
questions and answer keys -> save quiz -> grade submission -> update progress.

The model does not need to retype PDF formulas for quiz citations.
The server attaches the original excerpt from the selected source ID.
This prevents quotation-formatting errors without accepting invented sources.
Document topics can use evidence across the PDF rather than only one page.
Large evidence sets are sampled across the document to limit request size.

5. HOW TO START THE PROJECT NOW

The existing workspace is already set up.
Run these commands in your terminal:

cd /home/hetvihol/HAVKOUT2/frontend
npm run dev

Open this address in your browser:
http://127.0.0.1:5173

This one command starts both the frontend and Python backend.
The backend uses an automatically selected local port.
Keep the terminal open while using the app.
Press Ctrl+C to stop both servers.

After backend code or environment changes, stop and restart npm run dev.
Refresh the browser after restarting.

6. FIRST-TIME SETUP ON ANOTHER COMPUTER

Keep the frontend and backend folders together.
Install Node.js, npm and Python before setup.
The project's declared Node requirement is version 24 or newer.
The current workspace was also tested with Node 22.23.1.
The current Python environment is 3.15.0rc2; use an interpreter compatible with
the versions pinned in backend/requirements.lock.

Linux/macOS, from the project root:

python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
npm run dev

Windows, from the project root:

py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm ci
npm run dev

If backend/.env does not exist, copy backend/.env.example to backend/.env.
Keep an existing .env file so its configured keys are preserved.

7. HOW TO RUN ONLY THE BACKEND

From the project root on Linux:

cd backend
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001

API documentation:
http://127.0.0.1:8001/docs

Configuration-status endpoint:
http://127.0.0.1:8001/health

Database-readiness endpoint:
http://127.0.0.1:8001/ready

For normal app use, run npm run dev instead of starting a second backend.

8. API KEYS AND CONFIGURATION

Local configuration file:
backend/.env

GEMINI_API_KEY: Needed for AI tutoring, AI-generated quizzes and automatic
video/YouTube study-text extraction.
GEMINI_MODEL: Selects the Gemini model. The code default is
gemini-3.1-flash-lite. Provider availability and quota depend on your account.

No Supabase key is needed. Supabase is not integrated.
No YouTube API key is needed.
No external authentication API key is needed for local password accounts.

Without Gemini, you can still create accounts, organize courses, upload
readable documents, use prepared DBMS quizzes, review flashcards, and add
videos or YouTube links with a provided transcript.

Other settings:
APP_ENV: development locally; production enables Secure cookies.
AUTH_MODE: session by default. Development identities require explicit opt-in.
SESSION_DAYS: 7 by default.
DATABASE_PATH: .local-data/studymate.db under backend.
STORAGE_PATH: .local-data/files under backend.
MAX_UPLOAD_MB: 5 by default for documents.
MAX_VIDEO_MB: 50 by default for videos.
MAX_VIDEO_MINUTES: 60; recommended lesson duration and timestamp bound.
MAX_PDF_PAGES: 25 by default.
MAX_TEXT_CHARS: 80000 by default.
VIDEO_TIMEOUT_SECONDS: 180 by default.
CORS_ORIGINS: Exact browser origins allowed to access the API.

Default hourly learning-operation limits per account:
Uploads: 10.
Tutor requests: 30.
Quiz requests: 20.
Sample imports: 10.
Login requests also have account and network rate limits.

9. WHERE INFORMATION IS STORED

backend/.local-data/studymate.db:
Accounts, session fingerprints, courses, material records, extracted text,
quizzes, attempts, conversations, revisions and progress.

backend/.local-data/files/:
Original uploaded documents and videos.

backend/.env:
Private local configuration and the Gemini key.

Stopping or restarting the app does not delete saved data.
Material deletion removes its stored file and related learning content.
It also removes conversations in that material's course.
Deleting a material does not delete the original file on your computer.

10. PROJECT FOLDERS

frontend/app/: Main screen, shared styles and hosted API routes.
frontend/components/: Tutor, quizzes, materials, account screens and UI controls.
frontend/lib/: API client, shared types, sample data and practice selection.
frontend/hooks/: Reusable frontend behavior.
frontend/scripts/: Startup, checks, build and migration commands.
frontend/server/: Separate hosted TypeScript backend.
frontend/db/ and frontend/drizzle/: Hosted database schema and migrations.
frontend/public/ and frontend/sample-materials/: Public assets and DBMS examples.
frontend/tests/: TypeScript and practice-selection tests.
frontend/docs/: Setup, review and verification documents.

backend/main.py: FastAPI application, middleware and route registration.
backend/config.py: Application settings.
backend/database.py: SQLite schema and database operations.
backend/auth.py: Session checks and request-origin protection.
backend/routes/: Accounts, courses, materials, tutor, quizzes and revision APIs.
backend/services/: Gemini, video extraction, PDF/text extraction, retrieval,
grading and the prepared curriculum.
backend/tests/: Python tests.

11. HOW TO CHECK THE PROJECT

From the project root on Linux:

backend/.venv/bin/python -m unittest discover -s backend/tests -v
backend/.venv/bin/python -m pip check
cd frontend
npm run typecheck
npm test
npm run check:local
npm run build

The last completed verification passed 26 Python tests and 21 TypeScript tests.
Type checks, the connected HTTP smoke check and the production build passed.
Live Gemini tests also covered video extraction, public YouTube import,
quiz generation and the actual 12-page Bayes PDF reported in the error.

check:local uses port 5174 and a temporary database.
It disables live AI calls and removes its test data afterwards.
It can run while the normal app is open on port 5173.

npm run build creates the hosted Vinext/Cloudflare artifact.
A successful build does not mean the app has been publicly deployed.

12. CURRENT LIMITATIONS

Scanned PDFs need OCR, which is not included.
Private/unlisted YouTube videos and playlists cannot be extracted automatically.
Long videos may need a shorter clip or a supplied transcript.
AI transcripts can omit or misread content.
Source references identify saved excerpts; they do not independently prove
that every AI answer or generated answer key is correct.
For video sources, a quotation checked against AI-extracted text is not an
independent check of the original recording.
Short-answer grading matches expected terms and declared aliases; it does
not understand every correct paraphrase.
Adaptive quiz difficulty is not a validated personalized learning model.
Progress estimates use 70 percent previous mastery plus 30 percent latest
topic quiz accuracy; they are study estimates, not formal learning measures.
OCR, vector search, email verification, emailed password recovery, MFA and
social login for Python accounts are not implemented.
Local development-student data is not automatically attached to a new account.

13. SECURITY AND PUBLIC HOSTING

Account data is scoped to its owner.
Passwords are stored as Argon2id hashes.
Only session fingerprints are saved in the database.
Sessions expire and can be revoked.
The API checks mutation headers and browser origins.
Production cookies require HTTPS.
Never share .env, session cookies, local databases or private uploads.

For public Python deployment, configure HTTPS, persistent database/file storage,
exact allowed origins and a same-origin frontend/API reverse proxy.
The supplied development runner is restricted to local access.
Do not expose it as a production server.

The separate hosted Worker needs the supported trusted ChatGPT identity runtime.
It must not trust identity headers supplied directly by arbitrary callers.
No public deployment was performed as part of these changes.

14. COMMON PROBLEMS

Port 5173 is already in use:
Stop another running frontend process, then start the app again.

Python environment is missing:
Create backend/.venv and install backend/requirements.txt.

AI is unavailable:
Check GEMINI_API_KEY and GEMINI_MODEL in backend/.env, then restart.
The AI ready badge reports configured values, not guaranteed provider health.

Provider request fails:
Check model access, quota and network connectivity.

Video extraction fails:
Try a shorter supported video or paste its transcript.

PDF extraction fails:
Use an unencrypted PDF containing readable text, or upload TXT/Markdown.

Quiz generation fails:
Restart after code changes. Try fewer questions if the material contains little
useful text. Invalid generated structures or unsupported references are rejected.

Sign-in session expires:
Sign in again. Your saved course data remains in the database.

15. SHORT PROJECT DESCRIPTION

StudyMate AI is a full-stack study workspace built with React and TypeScript
on the frontend, Python and FastAPI on the local backend, SQLite for saved
data, and Google Gemini for AI-assisted learning. It supports private accounts,
documents, videos, YouTube lessons, source-linked tutoring, quizzes and revision.
