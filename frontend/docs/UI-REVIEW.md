# Frontend and authentication review — 13 October 2026

## Implemented

- Replaced local shared-student sign-in with actual Python email/password accounts. Signup, login, logout, password changes and private saved workspaces are connected through a same-origin API proxy.
- Default sessions use Argon2id password hashes, random HttpOnly cookies, hashed server-side tokens, expiry, revocation, CSRF protection, bounded request bodies and login rate limits. Test identity headers require explicit development opt-in and cannot authenticate in production.
- Added dedicated account screens, password visibility controls, autocomplete and password guidance, inline errors and pending states.
- Applied the supplied Figma reference's black/white/soft-gray palette, bold typography, pill buttons, round cards and restrained semantic status colors throughout the learning screens.
- Added a skip link, keyboard focus treatments, pressed states for library view controls, and clearer progress labels.
- Separated library filters from the active learning course; added a reset action for empty filtered results.
- Prevented stale upload selections, unavailable tutor submissions and invalid quiz material selections. Quiz sources follow the selected material, and stale topic selections reset.
- Fixed undefined topic chart labels, generalized course/topic copy, balanced the Python diagnostic bank across topics, and stopped stale responses from restoring private state after logout or session expiry.
- Split chart loading from the initial app bundle. The final build no longer reports oversized client chunks.
- Updated setup instructions so `npm run dev` starts the actual account backend. Hosted Worker development no longer enables mock authentication.

## Verification

- **16 Python tests passed:** account isolation, hashing, cookie flags, session persistence, expiry and revocation, duplicate accounts, CSRF, rate limits, password changes, oversized bodies, learning operations and diagnostic selection.
- **18 TypeScript tests passed:** existing hosted API and prepared curriculum behavior.
- TypeScript check and production Vinext build passed.
- Complete frontend/Python HTTP smoke check passed on an isolated temporary database; no Gemini requests were made by that check.
- Desktop browser check: sign-in, dashboard and practice configuration.
- Mobile browser check at 390 × 844: navigation, library, course creation, quiz submission/results, settings and sign-out. No horizontal overflow was observed. Browser error log was empty after the final signed-out check.
- Source review covered dashboard, courses, library/upload, knowledge, tutor, quizzes, progress, revision, settings and the explanatory pages. Browser checks exercised representative flows; not every possible input or hosted deployment was tested.

Screenshots: [desktop sign-in](screenshots/sign-in-desktop.jpg), [mobile sign-in](screenshots/sign-in-mobile.jpg).

## Boundaries

These changes are local source changes; no public deployment was performed. Python accounts and hosted ChatGPT/D1 workspaces remain separate. Existing development-student data is preserved in its old profile. Email verification, emailed password recovery, MFA and social login for Python accounts are not included. Production Python deployment needs HTTPS, a same-origin reverse proxy, exact allowed origins and persistent storage. Basic sign-in needs no external API key or Supabase project.
