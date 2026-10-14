# StudyMate AI

A responsive learning workspace with courses, private document/video uploads, YouTube lessons, source-grounded tutoring, prepared and AI quizzes, progress and revision cards. Its black, white and soft-gray styling takes inspiration from the [supplied Figma template](https://www.figma.com/community/file/1273571982885059508/e-commerce-website-template-freebie).

## Start locally

Prepare `../backend/.venv` and install `../backend/requirements.txt` as described in [the backend README](../backend/README.md). Then, from this folder:

```sh
npm ci
npm run dev
```

Use **http://127.0.0.1:5173**. Create an account with your email, name and a password of at least 12 characters. The runner starts Python and proxies the authenticated API on the frontend origin. SQLite and uploaded files persist under `../backend/.local-data`. Password changes and sign-out are available in Settings.

`npm run dev:local` is the same account-based runner. `STUDYMATE_PYTHON` selects an alternative Python executable; `STUDYMATE_PORT` changes the frontend port. Node 24+ is recommended by the project dependencies. The bundled verification also runs on the installed Node 22.23.1.

## AI configuration

Keep `GEMINI_API_KEY` and `GEMINI_MODEL` in the ignored **backend/.env** file for local use. Restart after configuration changes. Prepared sample quizzes and revision work without Gemini. Keys are never requested in the browser. The availability badge reports configuration presence, not guaranteed provider uptime or quota.

Video and YouTube study-text extraction also uses the existing Gemini key. No YouTube API key is required. In Upload Material, select Video upload or YouTube link; paste a transcript when automatic extraction is unavailable.

No Supabase or identity-provider API key is required for local password accounts. Email verification and emailed password recovery are not included.

## Hosted edition

The hosted Vinext/Cloudflare build continues to use trusted ChatGPT sign-in, D1 and R2. It uses different data and credentials from the Python account runner. Local mock sign-in is disabled. Do not deploy the Worker directly to an endpoint that lets callers forge the trusted identity headers; use the supported Sites dispatch layer.

```sh
npm run build
npm run db:migrate
npm run dev:hosted
```

`dev:hosted` is a Worker integration environment and needs the real trusted authentication runtime. For normal local development use `npm run dev`.

## Checks

```sh
npm run typecheck
npm test
npm run check:local
npm run build
```

`check:local` starts the complete app on **port 5174**, creates disposable password accounts, and checks session authentication, spoof rejection, CSRF, sample downloads, quizzes, grading, revisions, real PDF/video upload, YouTube transcript imports, video byte ranges, deletion and saved data after sign-in. It uses a temporary database and disables live Gemini requests. The normal preview on 5173 can remain open while this check runs.

See [UI review](docs/UI-REVIEW.md) for the changes and verification. Existing documents under `docs/` that describe the original Worker package are historical references; this README and the backend README describe the current local account workflow.

Never share `.env`, `.dev.vars`, `.local-data`, `.wrangler`, `node_modules`, or private uploads.
