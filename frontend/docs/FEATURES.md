# Features and honest scope

| Feature | Included behavior | Boundary |
| --- | --- | --- |
| Original interface | Dashboard, courses, library, tutor, practice, progress, knowledge and revision screens; original branding/styles retained | Browser visual regression check could not complete in this environment |
| Identity | Server-derived Sites identity; 401 for anonymous private data | Hosted sign-in needs Sites; local runner uses one development identity |
| Persistence | Profiles, courses, materials, text, chats, quizzes, attempts, topic history, cards, review events and activity | D1/R2 integration still needs hosted/runtime validation; SQLite/files HTTP journey passed |
| Uploads | Actual PDF/TXT/Markdown storage and server extraction, source viewer, rename/delete | 5 MB, 25 PDF pages, 80k extracted characters; no OCR, slides, images, audio or video processing |
| Sample DBMS | 4-page self-authored PDF, 4 concepts, 18 prepared questions, source-linked examples | Explicit sample load; not real student data or AI generation |
| Tutor | Configured Gemini, selected owned material, keyword retrieval, literal quote verification and saved history | No key = unavailable; lexical retrieval can miss relevant text; context is current question only |
| AI quizzes | Structured generation, source-quote checks, duplicate/type/count/key-format checks | Live calls not validated; no independent answer-correctness model; first 12 source chunks only |
| Prepared quizzes | Filtered sample bank; unseen questions prioritized, repetition reported | Small bank; Adaptive mixes available difficulties rather than a validated adaptive algorithm |
| Grading | Server-held keys, numeric/option/normalized-term comparisons; idempotent attempts | Short-answer paraphrases may be rejected; not suitable for consequential formal grading |
| Mastery | Zero starting estimate, explicit 70/30 update from assessed topic accuracy | Heuristic, not measured learning mastery; latest 100 attempts shown in state |
| Revision | Source excerpt cards, persisted reviewed events and weak-topic order | Uploaded documents get one document-level topic/card; exam plan is temporary and heuristic |
| Evaluation | Backend tests, HTTP smoke script, limits explained in UI/docs | No RAGAS/DeepEval benchmark, recall/factuality score, load test or learning-outcome study |
| Portability | Source, lockfile, migration, local runner, setup docs and configuration examples | Initial dependency download, Node 24+, and external accounts for hosted/AI use |

## Remaining work before claiming production readiness

Validate the built worker with real D1/R2 and hosted identity, run browser desktop/mobile checks, configure and test an actual Gemini model, benchmark retrieval/AI correctness, and test deployment/resource limits. Add robust background ingestion/retry, pagination/retention controls and semantic grading before larger-scale use. The current synchronous PDF path may exceed Worker CPU/memory for complex files despite size/page limits.

Gemini responses are rendered as React text, not HTML. Source documents are untrusted evidence. A quote match confirms provenance of that quote, not semantic entailment of every statement. Generated questions explicitly retain their verification limitation.

The original deterministic tutor helper remains in `lib/demo.ts` for legacy curriculum regression tests, but the live UI does not call it. No hidden simulated fallback runs when the provider is unavailable.
