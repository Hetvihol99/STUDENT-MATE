# Attribution

StudyMate branding/layout and the authored DBMS learning notes come from the recovered project. The sample PDF, Markdown, prepared concepts and question bank contain demonstration educational content, not imported private course documents. The favicon is an inline vector asset. The UI uses system font fallbacks; there are no separately bundled proprietary font files, photos or external stock assets.

## Bundled third-party source

- Sites Vite integration: upstream MIT notice retained in `build/sites-vite-plugin.LICENSE`.
- shadcn-related styles/source: retained notice in `vendor/shadcn-tailwind-4.13.0.LICENSE.md`. The UI components retain the original starter structure.
- Other starter integration helpers remain part of the recovered framework scaffolding.

## Installed dependencies

React/React DOM, Vinext, Vite, Cloudflare tooling, Drizzle, Zod, unpdf, Radix/shadcn-related UI libraries, Tailwind, Lucide and Recharts are installed from the included manifest/lockfile. `docs/DEPENDENCIES.md` records package versions and license declarations from that lockfile. This source ZIP does not redistribute node_modules. Preserve the installed packages' own license files when distributing compiled applications or dependencies. Package license metadata is an inventory, not a legal audit or a new license grant for upstream software.

unpdf bundles a serverless PDF.js implementation; PDF.js is under Apache-2.0. Respect its upstream notices when redistributing built artifacts. Implementation references: [unpdf](https://github.com/unjs/unpdf), [PDF.js](https://github.com/mozilla/pdf.js), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).

The team should choose its own license for original application changes before public repository publication. No blanket relicensing of third-party material is implied by this submission package.
