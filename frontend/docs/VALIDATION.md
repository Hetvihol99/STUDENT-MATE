# Validation record

Date: 10 October 2026. Environment: Windows, Node 24.19.0, npm, locked project dependencies. This file replaces the original frontend-demo validation report; earlier demo screenshots/checks are not evidence for the new backend edition.

## Checks performed

| Check | Result and scope |
| --- | --- |
| Actual source recovery | Recovered the user-supplied original StudyMate source ZIP; retained the original UI and framework. Source originals were not edited. |
| Clean lockfile install | `npm ci` succeeded in a separate source-only copy: 683 packages. Initial attempts failed from network/permission conditions; a fresh writable copy succeeded. No copied node_modules used for the successful install. |
| TypeScript | `npm run typecheck` passed. |
| Automated tests | 18 Node tests passed. Includes anonymous rejection, mutation-origin checks, owner isolation, sample idempotency, real text/PDF extraction, failed/oversized/unsupported uploads, source delete, server grading, hidden quiz keys, submission idempotency, persistent estimates, unavailable AI, verified quote contracts and conversation ownership. |
| Provider contract tests | Stubbed Gemini responses exercise structured reply parsing, exact-quote checks, history saving and rejection of fabricated citations. These are not live model calls. |
| Local HTTP journey | `npm run check:local` passed: local sign-in, forged identity-header rejection, cross-origin denial, HTML/module serving, sample load, quiz creation/submission, persisted review, actual four-page PDF upload/source retrieval/delete, missing-key error, and saved attempt after closing/reopening SQLite. |
| Hosted Worker build | `npm run build` passed; root app and `/api/study/:path*` produced. Non-blocking warnings: a frontend chunk exceeds 500 kB; Vinext cannot statically classify the root route. |
| Package hygiene | Source manifest contains DB/BUCKET declarations without an owner-specific project ID. Environment example contains blank safe values. Runtime data, private uploads, dependencies, logs, build output and Git history are excluded from delivery. |

## Checks that could not complete

- Cloudflare local migration/runtime: workerd terminated at startup (`std::terminate`, `ERR_RUNTIME_FAILURE`) before local D1 migration execution. SQL was applied and exercised by the SQLite adapters/tests. D1/R2 runtime compatibility still requires a successful check in another supported environment.
- Browser visual/interactive QA: Edge headless startup failed; the in-app browser could not connect to the isolated local server. **No desktop/mobile screenshot or end-to-end browser pass is claimed for this edition.** Source and module compilation plus HTTP tests do not prove visual layout or every UI interaction.
- Hosted ChatGPT identity, two-device persistence, protected secret provisioning, deployment migrations and real cloud object storage: not run. The trusted platform-header boundary is implemented; simulated identities verify application authorization only.
- Live Gemini tutoring or quiz generation: not run; no real key supplied. No provider quality, token-cost or latency metrics claimed.
- No independent AI answer-key verification, retrieval benchmark, adversarial corpus assessment, educational efficacy evaluation, production load test, dependency security audit or accessibility certification was performed.

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run check:local
npm run build
```

Use Node 24+. Stop the local runner before the HTTP check so port 5173 is free. The check uses a fresh ignored test directory and disables provider credentials. PDF.js may report missing optional standard-font data during extraction of the sample; extraction still returned all four pages and the expected primary-key text. Complex fonts/layouts need additional validation.

The final source ZIP integrity and file manifest are recorded in the adjacent `StudyMate-AI-Hackathon-package-check.txt`. This report does not certify production readiness. The original live site and its audience were left unchanged.
