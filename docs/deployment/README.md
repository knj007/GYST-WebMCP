# Deployment and Provider Guide

Last verified: 2026-08-30

## Vercel production

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
| Application release baseline | `369733b0f6eb50c1d9cf606b09b2e0a1c0b5b8ad` (before this documentation update) |
| Historical foundation deployment | `dpl_6mmxpMFXaSvFoH1xxHJf2zTzPUgJ` at `b6ba3ea27f862b2347b0eaaeb3af0ef1cbd7eb4c` |

The first Git-triggered build compiled successfully but failed packaging because the project used the `Other` framework preset and resolved its output directory to `public`. The project was corrected to the Next.js preset with automatic output detection, and the exact reviewed commit was redeployed successfully.

Current production state:

- Vercel automatically deployed the application baseline at `369733b0f6eb50c1d9cf606b09b2e0a1c0b5b8ad`.
- `/` — healthy production homepage.
- `/daily` — redirects to `/login?reason=configuration`.
- The redirect is expected: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` remain unconfigured in production. They are browser-safe values, but writing them is a separate A5 production-configuration approval and is not part of A2.
- Production Supabase now contains the two tracked migrations and 11 RLS-enabled, empty application tables. This changes the database foundation only; it does not make the ritual flows usable.

The deployed routes are an authenticated application shell, not proof that the daily/weekly ritual, human-only commit, WebMCP, reminder, or demo flows are complete.

Vercel's Git integration is connected to `main`. The repository does not yet contain GitHub Actions or another independent CI workflow, so the current production evidence relies on local verification plus Vercel's build and status checks.

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

- Worker source and `wrangler.jsonc` exist under `workers/reminders/`.
- Staging name: `gyst-reminders-staging`.
- Production name: `gyst-reminders`.
- The Worker currently exposes only `/health`; its scheduled handler is intentionally empty.
- Staging and production Wrangler dry runs pass.
- No Worker deployment, Cron Trigger, Turnstile widget, or Wrangler secret has been created remotely.
- Resend, sender identity, and real email delivery are not configured.

Validate the Worker without deploying:

```bash
npm run typecheck:worker
npm run worker:dry-run
```

## Release and rollback boundary

A production release packet must identify the exact commit, complete verification results, known issues, provider changes, and rollback target before approval. Git pushes, deployments, domains, secrets, remote provider configuration, Worker/Cron/Turnstile resources, and real email remain gated external writes.

The historical foundation deployment remains a rollback reference for application code. Database rollback is not allowed: use forward-only corrective migrations, and never repair production by weakening RLS.
