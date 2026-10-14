# Database and migrations

`db/schema.ts` is the Drizzle schema. `drizzle/0000_pale_genesis.sql` is the initial versioned migration; its `meta/` directory preserves Drizzle's snapshot and journal. Do not edit an applied migration—change the schema and run `npm run db:generate` to produce the next migration, then review its SQL.

| Table | Purpose and relationships |
| --- | --- |
| profiles | Platform-stable student ID and editable display name |
| courses | Owner → profiles; unique owner/name |
| materials | Owner + course; processing status, R2 key, size, page count, sample flag, error and deletion tombstone |
| pages | Material FK; unique material/page number; extracted text |
| chunks | Page FK; ordinal and overlapping retrieval text |
| topics | Owner + course; authored/sample or document-level metadata JSON, estimate and question counters |
| conversations | Owner + course and title |
| messages | Conversation FK; role, text, citation/evidence JSON and timestamp |
| quizzes | Owner + course + material, mode, verification label and expiry |
| questions | Quiz + topic FKs; ordinal and private full question/key JSON |
| attempts | Quiz + owner; **unique quiz ID** for one submission; score and complete review JSON |
| mastery_history | Owner + topic + attempt; resulting estimate and date |
| flashcards | Owner + topic; recall prompt/excerpt; unique owner/topic |
| revisions | Owner + topic; each reviewed event |
| activity | Owner, readable action and timestamp |
| rate_limits | Owner/operation key, count and reset timestamp |

Owner/course/time indices support scoped lookups. Foreign keys cascade through source pages/chunks, conversation messages and quiz attempt history. Question/topic references require quizzes to be removed before deleting topics, which the deletion operation does. SQL values are bound parameters; incoming IDs do not choose SQL table names.

## Local-only runner

`npm run dev:local` automatically creates `.local-data/study.sqlite`, applies every unapplied SQL migration, and writes originals into `.local-data/files/`. Its `local_migrations` ledger is adapter infrastructure, not a hosted table. It uses one local development student. No data directory is included in this ZIP. Restarting the command preserves records.

## Cloudflare local D1/R2

```sh
npm ci
npm run build
npm run db:migrate
npm run dev
```

The migration script derives a local-only Wrangler config from the generated `dist/server/wrangler.json`, uses binding `DB`, and points at `drizzle/`. Wrangler records applied migrations. Local D1/R2 state lives under `.wrangler/`; it is separate from `.local-data/`. Rebuild before migrations when binding configuration changes. Local Worker startup was blocked in this packaging environment; this path needs a successful runtime check elsewhere.

## Hosted storage

`.openai/hosting.json` declares `d1: "DB"` and `r2: "BUCKET"` and intentionally has no previous owner's Site ID. Through Sites deployment, migrations are packaged under `dist/.openai/drizzle`. Confirm storage provisioning and migration application in the new deployment result, then run signed-in smoke checks. Never point a teammate at the original deployment's database or object bucket. No remote migrations were run while preparing this package.

Sample materials only enter a student's database after the explicit sample-load action. Seeding is owner-scoped and idempotent while the sample source is ready. Deleting and reloading the sample resets that source's learning history. Sample source files contain authored educational content, not real student records.
