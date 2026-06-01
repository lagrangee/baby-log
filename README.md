# Baby Log

Baby Log is a single-family baby-care log built on Cloudflare Workers, Static Assets, and D1. It is designed for fast daily recording, checklist and milestone tracking, a simplified read-only family view, a standalone machine-readable JSON endpoint, and full export.

[中文 README](./README.zh-CN.md)

## Scope

Baby Log helps a family observe, record, summarize, and prepare questions for clinicians. It is not a medical diagnosis system, clinical decision support tool, social product, multi-tenant SaaS, or attachment/photo manager.

The built-in quick actions are intentionally limited to breast feeding, bottle feeding, pee, poop, sleep start/wake up, temperature, medicine, and note. Secondary records are symptom, tummy time, and growth measurement.

## Features

- Admin daily log with quick actions and detail sheets.
- Read-only family view with a small helper recording surface.
- Checklist and milestone tracking.
- Status, timeline, pediatric-summary, growth-reference, and machine JSON endpoints.
- Full export archive.
- English and Chinese UI switching from the app header/login screen.

## Architecture

- Cloudflare Worker serves API routes.
- Cloudflare Static Assets serves the React/Vite app.
- Cloudflare D1 is the only source of truth.
- Daily summaries are derived from event rows, not stored as a separate source of truth.
- Stored timestamps are UTC.
- `local_date` is derived server-side from `app_profile.timezone`.
- The machine endpoint is standalone JSON and does not depend on cookie login.

## Local Development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run build
npm run d1:migrate:local
ALLOW_DEV_DEFAULT_PASSWORDS=true npm run cf:dev -- --local --port 8787
```

When `ALLOW_DEV_DEFAULT_PASSWORDS=true` is set locally, the development fallback passwords are:

- admin: `admin`
- read-only: `read`

Do not enable fallback passwords in production.

## Cloudflare Configuration

`wrangler.toml` is a public template only. Keep placeholder routes and placeholder D1 IDs in Git. Put real domains, D1 IDs, tokens, and passwords in ignored local files, generated deploy config, or Cloudflare settings.

Create the D1 database:

```bash
npx wrangler d1 create baby_log
```

Copy the returned database ID into a private deployment configuration, or update it in the Cloudflare dashboard. For local command-line deploys, keep real values in ignored files such as `wrangler.local.toml` or `wrangler.prod.toml`.

Set production runtime variables and secrets in the Worker settings, not in Git:

- `ADMIN_PASSWORD`
- `READ_PASSWORD`
- `SESSION_SECRET`
- `BABY_LOG_MACHINE_BASE_URL`
- `BABY_LOG_MACHINE_TOKEN`

Optional local automation variable:

- `BABY_LOG_CHATGPT_SOURCE_DIR`

Apply D1 migrations:

```bash
npm run d1:migrate:local
npm run d1:migrate:remote
```

Deploy with an ignored local Wrangler config:

```bash
cp wrangler.toml wrangler.local.toml
# Edit wrangler.local.toml with the real Worker route and D1 database ID.
npm run cf:deploy:local
```

Deploy with a generated Wrangler config:

```bash
cp .env.example .env
# Edit .env with the real Worker route and D1 database ID.
npm run cf:deploy
```

Cloudflare Workers Builds can connect to GitHub with:

- build command: `npm run build`
- deploy command: `npm run cf:deploy`
- production branch: `main`
- required build variables/secrets: `BABY_LOG_WORKER_NAME`, `BABY_LOG_ROUTE_PATTERN`, `BABY_LOG_D1_DATABASE_NAME`, `BABY_LOG_D1_DATABASE_ID`

The generated deploy config uses `keep_vars = true` by default so a Wrangler deploy does not overwrite runtime variables managed in the dashboard.

If you connect an existing Worker to this repository, make sure the Worker name in Cloudflare matches `BABY_LOG_WORKER_NAME`. To move an existing Worker from an old Git repository to `lagrangee/baby-log`, disconnect the old build integration first, reconnect the Worker to the new repository, then push a small commit to confirm the build.

Run production D1 migrations deliberately; do not assume a Git push has migrated the remote database.

## Public Repo Hygiene

Before pushing to a public repository:

- Keep `.dev.vars`, `.env`, real `wrangler.*.toml` files, exports, review bundles, SQLite files, and planning docs out of Git.
- Commit only placeholder Cloudflare route and D1 IDs.
- Run secret scans on the clean public repository.
- Treat family facts, exported records, machine tokens, D1 IDs, and real domains as private.

## Scripts

```bash
npm test
npm run build
npm run chatgpt:export
npm run review:zip
```

## License

No license has been declared yet. Add one before inviting broad external reuse.
