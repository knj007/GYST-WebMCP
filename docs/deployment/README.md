# Deployment and Provider Guide

Last verified: 2026-09-01

## Vercel production

### Wave 6 release update

PR #12 merged as `09f4fae` after Vercel checks passed. Vercel Git integration deploys `main`; the current production URL is `https://gyst-web-mcp.vercel.app`.

| Setting | Current value |
| --- | --- |
| Account identity | `knj007-7962` |
| Team | `knj007` |
| Project | `gyst-web-mcp` |
| Git repository | `knj007/GYST-WebMCP` |
| Production branch | `main` |
| Framework | Next.js |
| Root directory | `.` |
| Output directory | Next.js default |
| Node.js | 24.x |
| Production URL | `https://gyst-web-mcp.vercel.app` |
| Current application release | `09f4fae` (PR #12) |
| Historical activation evidence | `docs/deployment/production-a5-a9-evidence-2026-08-30.md` |

Current production state:

- `/` is healthy; unauthenticated protected routes redirect to `/login`.
- Public signup is protected by Turnstile. Vercel Production holds `TURNSTILE_SECRET_KEY` as a server-only secret and the browser-safe Turnstile site key as configuration. Values are not documented.
- Vercel Production holds browser-safe Supabase URL and publishable-key configuration. The app never receives a Supabase secret key.
- The Resend Marketplace integration supplies `RESEND_API_KEY` to Vercel Production for provider management. The deployed reminder Worker receives its own encrypted Cloudflare secret; no key value is stored in this repository.
- Daily/weekly ordinary flows and fourteen draft/read-only WebMCP tools are merged and deployed. WebMCP still cannot commit or delete ledger records.
- Current release evidence is [production-wave6-evidence-2026-09-01.md](production-wave6-evidence-2026-09-01.md). The dated A5/A9 record remains historical evidence for its narrower 2026-08-30 activation scope.

## Read-only verification

Vercel CLI 59.10.0 was used for the checkpoint. Pin the CLI version when reproducing release evidence. On this Windows host, the authenticated CLI store is under the existing Vercel configuration directory shown below; the directory contains credentials and must never be inspected or committed.

```powershell
$vercelConfig = Join-Path $env:APPDATA 'com.vercel.cli\Data'
npx --yes vercel@59.10.0 whoami --global-config $vercelConfig
npx --yes vercel@59.10.0 project inspect gyst-web-mcp --scope knj007 --global-config $vercelConfig
npx --yes vercel@59.10.0 inspect https://gyst-web-mcp.vercel.app --scope knj007 --global-config $vercelConfig
npx --yes vercel@59.10.0 logs --project gyst-web-mcp --environment production --level error --since 1h --scope knj007 --global-config $vercelConfig
```

Never read, print, copy into commands, or commit the Vercel authentication store. Use the interactive `vercel login` and `vercel logout` flows for credential lifecycle operations.

## Cloudflare and email state

- Turnstile widget `gyst-signup` is active for the production application.
- Worker `gyst-reminders` is deployed. Its public health endpoint is `https://gyst-reminders.gyst.workers.dev/health`; the worker has one UTC schedule, `*/15 * * * *`.
- The Worker invokes a typed scheduled handler and only the narrow Supabase reminder-delivery RPCs. It has no D1, KV, R2, direct ledger-table contract, or public send endpoint.
- Cloudflare holds encrypted Worker secrets by name only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `REMINDER_FROM_EMAIL`.
- Resend is configured on the free plan, connected to Vercel Production, and the `geekindad.com` sending domain is verified. The one approved delivery test was accepted and reported delivered.
- SPF and DKIM are configured. A separate monitor-only DMARC decision remains pending; do not add or modify DNS records without explicit approval.

Validate the Worker without deploying:

```bash
npm run typecheck:worker
npm run worker:dry-run
```

## Release and rollback boundary

A production release packet must identify the exact commit, complete verification results, known issues, provider changes, and rollback target before approval. Future Git pushes, deployments, domains, secrets, remote provider configuration, Worker/Cron/Turnstile resources, and real email remain gated external writes.

The historical foundation deployment remains a rollback reference for application code. Database rollback is not allowed: use forward-only corrective migrations, and never repair production by weakening RLS.
