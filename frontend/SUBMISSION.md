# StudyMate AI

## Problem

Students often have course notes spread across files and lack a consistent way to move from reading to source-backed explanations, practice, feedback and revision.

## Solution

StudyMate AI combines a personal learning library, evidence-linked tutoring, assessments, progress estimates and recall tools in one calm workspace. It preserves the existing product design while adding authenticated, owner-scoped server operations and persistent learning records.

## Main features

- Courses and privately stored PDF/text materials with real extraction and page-linked source viewing.
- Explicitly configured Gemini tutor and AI quizzes; clear unavailable states without credentials.
- Prepared public DBMS sample notes and practice bank, usable without an AI account.
- Server-side answer checking, saved attempts, transparent mastery estimates and revision history.
- Original dashboard, material library, knowledge, tutor, practice, progress and revision screens.
- Complete source, versioned migrations, portable local runner and technical documentation.

## Technology

React 19, TypeScript, Vinext/Vite App Router, Cloudflare Worker, D1/SQLite, R2, Drizzle, unpdf/PDF.js, Gemini HTTP API, Zod, Tailwind/Radix/shadcn UI, Lucide and Recharts. Local-only development uses the same handlers with SQLite and disk-file adapters.

## Demonstration and evidence

Use `README.md` to run locally and `docs/DEMO.md` for a 3–5 minute presentation. `docs/VALIDATION.md` distinguishes passed automated/local API checks from unverified hosted/provider/browser behavior. This is a hackathon implementation with documented boundaries, not a claim of production readiness or validated educational efficacy.

Existing live website: [StudyMate AI](https://studymate-ai-learning-workspace.syrupypetal2.chatgpt.site). This link is the earlier published demo. The package was not deployed and the site's audience was not changed.

## Team details — complete before submission

- Team name: ____________________
- Members and roles: ____________________
- Institution: ____________________
- Contact: ____________________
- Hackathon/track: ____________________
- Team repository: ____________________
- Demo video: ____________________
- New validated deployment URL, if any: ____________________

## Declaration

The included DBMS material is self-authored sample educational content. No real student records, private uploads, API keys or Git history are included. External dependencies retain their own licenses; see `docs/ATTRIBUTION.md` and included license notices.
