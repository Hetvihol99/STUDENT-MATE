# Deployment through Sites

This package was prepared for submission and sharing. **No deployment, audience change, remote migration or hosted secret change was performed.** The existing public URL refers to the previously published demo, not this un-deployed package.

## Supported route

Use the Sites plugin/workflow available in Codex. Keep the combined Vinext Worker application and the supplied `build/sites-vite-plugin.ts` integration. Do not deploy `scripts/dev-local.mjs`, its development cookie, or local SQLite adapters to the internet.

For an independent teammate deployment:

1. Open this extracted source in Codex with Sites enabled. Ask it to register a **new private Site from this retained source**. The portable `.openai/hosting.json` has only `d1: "DB"` and `r2: "BUCKET"`; it must not acquire the original owner's ID.
2. The supported `create_site` operation returns the teammate's project ID and source credential. The plugin's `set-project-id.mjs --project-id <returned-id>` helper records that ID. Do not invent IDs or reuse an unrelated Site. Initialize/synchronize source only through the supported source workflow.
3. Preserve DB/R2 declarations. Add hosted `GEMINI_API_KEY` and `GEMINI_MODEL` through native Sites runtime configuration tools if those capabilities are available for the account. Keep values out of the manifest, repository, archive, command arguments and client code. If protected runtime configuration is unavailable, deploy with AI explicitly unavailable; do not embed the key as a workaround.
4. Run `npm run typecheck`, `npm test`, `npm run check:local` where supported, and the plugin's `build-site.mjs` helper. The project build emits a Worker and copied hosting/migration metadata under `dist/.openai/`.
5. Use the plugin's `site-workflow.mjs --project-id <returned-id>` helper. Supply the credential to its hidden stdin JSON channel, remaining ordered check/build commands and an absolute publication archive path. This helper owns source commit/push and archive packaging. The ZIP in this submission is **source for teammates**, not a substitute for that publication archive.
6. Pass the helper's verified project ID, commit SHA and unchanged archive to the native Sites save/deploy operation. For a confirmed owner-private Site, use the private deployment flow. Preserve the selected audience. Wait for a terminal deployment result and retain the returned version and URL.
7. Verify storage provisioning/migration completion. Test anonymous private API denial, top-level sign-in, two different students' ownership boundaries, upload/source/delete, quiz save/refresh, source citations and configured/unconfigured AI behavior before declaring the deployment ready.

Plugin helper locations depend on the installation. Refer to the installed Sites SKILL.md for their actual absolute paths and current supported tool contracts. There is intentionally no hardcoded machine path, stored source credential or owner-specific remote in this package.

## Updating the original site later

That is a separate explicitly authorized deployment action. Open the original Site through its supported source workflow, preserve its exact project identity and audience, inspect current changes, merge this package deliberately, validate and then publish. Do not simply replace an existing manifest with the portable one.

## Security boundary and limitations

The server trusts authenticated headers injected by Sites dispatch. A direct public worker endpoint that lets callers supply those headers is unsafe. Do not use generic `wrangler deploy` as a shortcut without an equivalent trusted authentication boundary.

Cloudflare runtime startup failed in the packaging environment before migrations could execute. Production build success and local SQLite HTTP tests do not prove D1/R2 runtime compatibility or hosted sign-in. Live Gemini requests and resource usage are unverified. Confirm the currently supported Gemini model, quota and protected runtime secret capability before enabling AI.
