# GYST WebMCP

GYST is a human-owned daily and weekly ritual ledger. The application can read bounded context and help prepare drafts, while only the person can commit a record to the ledger.

## Current checkpoint

Before PR #4, GitHub `main` resolved to `c576e08d7a3151dc8cff7939ae56f347633f4263` (the documentation-only merge of PR #3). The production application's A5/A9 activation baseline is `04851f557d24d4c43d65106ba5f4beb302613191`; the subsequent documentation-only merge did not change application code. The approved Wave 2 migration is present in production, and the two browser-safe Supabase values have been configured in Vercel Production under separate A5 approval:

- Production: <https://gyst-web-mcp.vercel.app>
- Next.js App Router: public landing/sign-in plus request-dynamic authenticated `/daily` and `/weekly` shells
- Supabase clients: pinned browser/server SSR clients using only the publishable key, cookie refresh in Proxy, and centralized `getClaims()` authorization
- Hosted Supabase: Postgres 17 with `20260830160046` remediation plus `20260830194920` Wave 2 application schema; the local Wave 3 branch additionally has the unreviewed `20260830211216_daily_ritual_commit` migration
- Production ledger: 11 empty application tables, RLS enabled on every table, no `anon` application-table privileges, and operation-specific `authenticated` policies
- Database evidence: the production Wave 2 gate passed at 120 pgTAP assertions; the current local Wave 3 reset passes 135 assertions and error-level lint, with no advisor security/error finding
- Performance advisors: local post-pgTAP has three expected informational unused-index notices; the new, empty production schema has 18 informational unused-index notices and no security/error finding
- Reminder Worker: local skeleton and successful Wrangler dry runs only

The production homepage is healthy. `/daily` now redirects an unauthenticated visitor to `/login`, confirming that the application can read its browser-safe Supabase configuration; no real user was created or signed in for this check. The current local Wave 3 branch adds the ordinary daily draft form and a `SECURITY INVOKER` atomic human commit RPC; neither has been reviewed, merged, or applied to production. Weekly ritual, WebMCP draft tools, reminders, Turnstile, Resend, and demo ledger still need to be built. See [the production activation evidence](docs/deployment/production-a5-a9-evidence-2026-08-30.md) for the sanitized A5/A9 record.

## Local development

Requirements:

- Node.js 24.13.0 (`.nvmrc` pins the repository runtime)
- npm 11.8.0
- Docker Desktop
- Supabase CLI 2.116.0 or newer

If Docker is not available in an existing Windows process, prepend `C:\Program Files\Docker\Docker\resources\bin` to that process's `PATH`.

Install dependencies and start the local services:

```bash
npm ci
supabase start --ignore-health-check
npm run dev
```

The application runs at <http://127.0.0.1:3000> and Supabase Studio at <http://127.0.0.1:54323>. Local Supabase analytics are intentionally disabled; the core database, Auth, API, Storage, Realtime, Studio, and test-mail services remain available.

The application shell does not require provider values. When integrations are added, copy `.env.example` to an ignored local environment file and supply values there. Never commit or print provider values.

Stop local Supabase when it is no longer needed:

```bash
supabase stop
```

## Verification

```bash
npm run lint
npm run typecheck
npm run typecheck:worker
npm run test
npm run build
npm run test:e2e
npm run worker:dry-run
supabase db reset
supabase test db
supabase db lint
supabase migration list --local
```

## Documentation

- `docs/EXECUTION_RUNBOOK.md` — ownership, approval gates, execution waves, and the dated status checkpoint
- `docs/database/README.md` — database state, local workflow, migrations, and RLS evidence requirements
- `docs/deployment/README.md` — Vercel/Cloudflare state, verification, rollback, and release boundaries
- `docs/submission/README.md` — competition readiness and outstanding evidence
- `AGENTS.md` — concise repository rules for coding agents
