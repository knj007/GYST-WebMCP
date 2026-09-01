# Submission Readiness

Last verified: 2026-09-01

Status: Wave 6 signup protection and stateless reminder delivery are merged and deployed to production. Product and submission evidence are still not ready.

Wave 5 evidence: all fourteen required WebMCP read/draft tools are implemented with AbortController lifecycle cleanup and no commit/delete/export/history/SQL tool. Local unit coverage is 9 files / 24 tests and ordinary-form browser regression remains 3 tests. In the supported in-app browser against the `codex/wave5-webmcp` Vercel preview, an isolated fictional user authenticated successfully; the daily and weekly seven-tool surfaces discovered, oversized input was rejected, draft mutations visibly recorded non-committing audit entries, and the tools disappeared off ritual routes. A direct ledger check confirmed the daily and weekly sessions remained drafts.

## Evidence already established

- PR #12 (`09f4fae`) merged Wave 6. All six tracked Supabase migrations, including the reminder delivery RPC contract, are applied to production.
- Public signup is Turnstile-protected with server-side Siteverify before Supabase Auth signup. Browser-visible configuration contains only the Turnstile site key.
- The deployed `gyst-reminders` Worker has the UTC `*/15 * * * *` cron trigger. It is stateless; idempotency and delivery state live only in Supabase `notification_events`.
- Resend is connected and `geekindad.com` is verified. One approved real-recipient test was accepted and reported delivered. The test reached Gmail spam, so future sender-reputation/DMARC work remains an operational follow-up.
- Legacy Supabase JWT API keys are disabled. Production uses publishable/secret keys, kept in provider configuration only.
- Current local release evidence passes 6 pgTAP files / 214 assertions, 14 Vitest files / 49 tests, app and Worker type checks, lint, production build, Worker dry-run, and Supabase lint/advisors.
- PR #6 (`076f1a5`) merged the daily/weekly ordinary-form rituals, bounded weekly findings, and local-only fictional seed. The Wave 4 migration is applied remotely and remote migration history/error-level lint pass; remote advisors have no security/error finding.
- Local evidence now passes 5 pgTAP files / 177 assertions, 7 Vitest files / 20 tests, 3 Playwright tests, lint, typecheck, and production build.
- The fictional demo ledger is deterministic and reset-safe but local-only; production has no demo identity or application data.

- Clean, reproducible Next.js/npm foundation with pinned runtime and dependency versions.
- Local Supabase reset, pgTAP, lint, and security-advisor workflow.
- Removal of the untracked hosted RLS helper and event trigger.
- Approved production application of the 11-table Wave 2 schema with RLS enabled, no `anon` table privileges, and operation-specific authenticated policies.
- Fresh local reset and all 120 pgTAP assertions pass; local and production error-level lint pass; production security advisors have no findings.
- Healthy production homepage at `https://gyst-web-mcp.vercel.app`; before PR #4, GitHub `main` was `c576e08` (documentation-only), while the active application behavior remains the A5/A9 baseline (`04851f5`).
- Browser-safe production Supabase URL and publishable-key configuration is complete. Authenticated daily and weekly route shells exist; unauthenticated production `/daily` now redirects to `/login`, not to configuration.
- Ownership and approval rules recorded in `AGENTS.md` and the execution runbook.

## Required before submission

- Supabase Auth custom SMTP for reliable confirmation delivery (tracked separately).
- Gmail deliverability follow-up: decide on a monitor-only DMARC record and warm the verified sending domain deliberately.
- Production-level end-to-end evidence of a naturally due reminder, without manufacturing ledger history.
- Fictional demo ledger and repeatable judge/demo account setup.
- Export and deletion behavior with ownership tests.
- Full lint, type-check, unit, database, build, E2E, browser, secret, and private-data audit.
- Approved release candidate, production verification, rollback evidence, demo video, and final submission copy.

## Submission boundary

Do not describe the current authenticated shell or production database foundation as a completed product. Do not create judge accounts, send real email, expose a preview, publish a video, submit competition materials, or make another production mutation without the corresponding approval gate.

All demo content must be fictional and must not reuse private personal context.
