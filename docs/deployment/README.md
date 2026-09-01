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
- Public signup and the judge demo are both protected by Turnstile, verified by Supabase Auth rather than by the application. Vercel Production holds only the browser-safe Turnstile site key; the Turnstile secret belongs in Supabase Auth captcha configuration. Values are not documented.
- The judge demo signs a visitor in anonymously and seeds a fictional ledger scoped to that throwaway identity. It requires two hosted Supabase Auth settings that no migration can apply: anonymous sign-ins enabled, and Turnstile captcha enabled. Both must land with or before the deploy — the anonymous sign-in endpoint is publicly reachable with the browser's publishable key, so captcha is its only abuse control and an application-side check cannot substitute for it.
- Vercel Production holds browser-safe Supabase URL and publishable-key configuration. The app never receives a Supabase secret key.
- The Resend Marketplace integration supplies `RESEND_API_KEY` to Vercel Production for provider management. The deployed reminder Worker receives its own encrypted Cloudflare secret; no key value is stored in this repository.
- Daily/weekly ordinary flows and fourteen draft/read-only WebMCP tools are merged and deployed. WebMCP still cannot commit or delete ledger records.
- Current release evidence is [production-wave6-evidence-2026-09-01.md](production-wave6-evidence-2026-09-01.md). The dated A5/A9 record remains historical evidence for its narrower 2026-08-30 activation scope.

## Auth gate verification (run before every release)

The judge demo depends on two hosted Supabase Auth settings that no migration, test, or CI check can observe, and whose absence fails open rather than closed. Verify them against the running project and record the result in the release evidence packet.

```bash
# 1. Anonymous sign-ins must be ENABLED: expect an access_token, not a 422.
curl -s -X POST "$SUPABASE_URL/auth/v1/signup"   -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "content-type: application/json" -d '{}'

# 2. Captcha must be ENFORCED: expect a rejection, NOT an access_token.
#    A success here means the endpoint is unprotected.
curl -s -X POST "$SUPABASE_URL/auth/v1/signup"   -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "content-type: application/json"   -d '{"gotrue_meta_security":{"captcha_token":"not-a-real-token"}}'
```

Delete any anonymous identity these checks create. Both must pass before `main` is merged, because Vercel Git integration deploys `main` on merge.

## Anonymous identity retention

Each demo visit creates one permanent `auth.users` row plus roughly 25-30 ledger rows. Supabase performs no automatic cleanup. Until a scheduled job exists, purge stale demo identities deliberately; the cascade removes their ledger with them.

```sql
delete from auth.users
where is_anonymous is true
  and created_at < now() - interval '7 days';
```

An anonymous session can also insert its own `reminder_rules` through PostgREST. Those can never send, because the delivery claim requires a non-null `auth.users.email`, but they do accumulate `notification_events` rows that stay `pending`. The purge above removes them.

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
