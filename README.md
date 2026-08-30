# GYST WebMCP

GYST is a human-owned daily and weekly ritual ledger. The application can read bounded context and help prepare drafts, while only the person can commit a record to the ledger.

## Current checkpoint

The deployed baseline remains commit `b6ba3ea` on `main`. The current local worktree has advanced through the Wave 2 foundation without changing any remote resource:

- Production: <https://gyst-web-mcp.vercel.app>
- Next.js App Router: public landing/sign-in plus request-dynamic authenticated `/daily` and `/weekly` shells
- Supabase clients: pinned browser/server SSR clients using only the publishable key, cookie refresh in Proxy, and centralized `getClaims()` authorization
- Local Supabase: Postgres 17 with the remediation migration plus the 11-table Wave 2 ledger schema
- Local database evidence: fresh reset, 120 pgTAP assertions, error-level lint, and security advisors pass
- Hosted Supabase: remediation migration only; the Wave 2 schema remains local pending an A2 evidence packet and explicit approval
- Reminder Worker: local skeleton and successful Wrangler dry runs only

The daily/weekly ritual forms, atomic human commit, WebMCP tools, reminders, Turnstile, Resend, and demo ledger still need to be built. The production site remains the earlier static shell until a separately approved release.

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
