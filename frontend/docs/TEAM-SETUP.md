# Team setup

1. Keep the `frontend/` and `backend/` folders together.
2. Create `backend/.venv` and install `backend/requirements.txt` using the backend README.
3. Keep any existing `backend/.env`; configure Gemini there if AI tutoring is needed.
4. In `frontend/`, install dependencies with `npm ci`.
5. Run `npm run dev` and open http://127.0.0.1:5173.
6. Create your own account. The local runner now uses real password accounts, not a shared development student.
7. Load the sample notes, or create a course and upload your own supported file.
8. Use Settings for profile edits, password changes and sign-out.
9. Run `npm run typecheck`, `npm test` and `npm run check:local` before sharing changes.

Local Python accounts and hosted ChatGPT/D1 accounts are separate. Existing development data remains in its original profile. Never copy another person's database, session cookies, environment files or private uploads into a shared repository.

Basic authentication and prepared practice need no API keys. The local Python AI backend reads `backend/.env`; the hosted Worker uses protected runtime configuration. See the current READMEs for deployment boundaries.
