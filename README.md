# GYST WebMCP

GYST is a human-owned daily and weekly ritual ledger. The application can read bounded context and help prepare drafts, while only the person can commit a record to the ledger.

## Current checkpoint

Last verified — 2026-09-02:

- Production is [gyst-web-mcp.vercel.app](https://gyst-web-mcp.vercel.app). The current release is `e5d664a` (PR #22), deployed and Ready from `main`.
- A judge or reviewer can open the product without an account, verified live in production on 2026-09-01. "Open the demo" signs the visitor in anonymously behind Turnstile and seeds a fictional ledger scoped to that throwaway identity: a full prior week of committed days, its detected patterns, and today left open to conduct. Every visitor gets a separate ledger, so one visitor's commit never changes what the next one sees, and no shared demo credential exists to distribute or maintain.
- The demo's fictional data is generated relative to the current week at call time, so it never goes stale. `supabase/seed.sql` drives the same RPC rather than restating the persona.
- Hosted Supabase has all nine tracked migrations through `20260901155949_add_account_deletion_rpc.sql`. Remote history matches local and remote error-level lint reports no schema errors. The ledger remains the only durable application record; the Worker is stateless and may only claim/reconcile notification events through narrow service-role RPCs.
- Public signup and the demo entry point both use Cloudflare Turnstile, verified by Supabase Auth rather than by the application. The browser receives only the site key; the secret lives in Supabase Auth configuration. Supabase Auth has anonymous sign-ins and CAPTCHA protection enabled, and both were confirmed against the running project.
- The `gyst-reminders` Cloudflare Worker is deployed with a UTC `*/15 * * * *` Cron Trigger. It has no D1, KV, R2, or ledger-write capability outside the reviewed Supabase reminder RPCs.
- Resend is connected to Production and `geekindad.com` is verified. The Worker uses a server-only From address. A one-message real-recipient delivery test was accepted and reported delivered by Resend.
- Legacy Supabase `anon` and `service_role` JWT keys are disabled. The application uses the publishable key and the Worker uses the newer secret key, both held only in provider configuration.
- The WebMCP surface is fourteen ritual tools — seven on the daily ritual, seven on the weekly — plus three read-only status and navigation tools registered before hydration so an agent arriving early can still orient itself. Every one of the seventeen is read-only or draft-only. There is no commit, delete, export, history, or SQL tool, and a unit test fails the build if one appears. Normal human commit controls remain separate.
- Signed-in owners can configure, pause, and resume daily and weekly ritual email reminders from `/settings/schedule`. Schedules use the owner's profile timezone; first use safely initializes that profile from the browser timezone. The browser role calls one owner-scoped `SECURITY INVOKER` RPC, while the Worker remains the only delivery actor.
- Signed-in owners can export their committed ledger as portable `gyst-portable-v1` JSON or Markdown, take an explicit full backup that includes drafts, and permanently delete the account. Export is owner-scoped and deliberately has no WebMCP tool.
- Local verification passes 9 pgTAP files / 270 assertions, 22 Vitest files / 101 tests, app and Worker type checks, lint, production build, Worker dry-run, local and remote Supabase lint, local/remote migration parity, and all six Playwright specs.

### Draft-save acknowledgement

Saving a daily or weekly draft now leaves its confirmation message visible. The save remains editable and does not commit the ledger record.

Current release evidence is [docs/deployment/production-wave8-submission-evidence-2026-09-02.md](docs/deployment/production-wave8-submission-evidence-2026-09-02.md), which records the full pre-submission release gate. Historical production activation evidence is retained in [docs/deployment/production-a5-a9-evidence-2026-08-30.md](docs/deployment/production-a5-a9-evidence-2026-08-30.md); it records the narrower 2026-08-30 scope and is not the current status.

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
- `docs/deployment/production-wave6-evidence-2026-09-01.md` — sanitized Wave 6 provider and release evidence
- `docs/deployment/production-judge-demo-evidence-2026-09-01.md` — sanitized judge demo provider and release evidence
- `docs/deployment/production-wave8-submission-evidence-2026-09-02.md` — full pre-submission release gate and audit
- `docs/submission/README.md` — competition readiness and outstanding evidence
- `docs/submission/webmcp-demo-recording-script.md` — demo video shooting script
- `AGENTS.md` — concise repository rules for coding agents
