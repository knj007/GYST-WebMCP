# Submission Readiness

Last verified: 2026-09-01

Status: Wave 6 signup protection and stateless reminder delivery are merged and deployed. The judge demo closes the largest remaining submission gap — reaching a populated product without an account — but product and submission evidence are still not complete.

Wave 7 is locally implemented and verified, but not yet approved for remote migration or deployment: permanent-account Settings offers committed-only `gyst-portable-v1` JSON and Markdown archives, an explicit full JSON backup that includes drafts, and deliberate permanent-account deletion. The export endpoints use the caller's owner-scoped session and do not expose a WebMCP export/history tool. Local evidence now includes 9 pgTAP files / 270 assertions, 20 Vitest files / 92 tests, and 6 Playwright specs, including a JSON count comparison against owned local fixture rows.

## Judge access

Judges do not need credentials. The public site offers "Open the demo", which signs the visitor in anonymously behind Turnstile and seeds a fictional ledger belonging only to that session: a full committed prior week, its detected patterns, and the current day left open to conduct and commit.

This replaces the shared demo account the plan previously implied. A shared account would have broken after the first judge: `ritual_sessions` is unique on `(user_id, kind, period_start)` and committed sessions are immutable, so the first commit would have left every later judge unable to perform the draft-to-commit demonstration at all. Per-session ledgers also make owner isolation something a judge can observe rather than something the submission asserts.

Both required hosted Supabase Auth settings are enabled and were confirmed on 2026-09-01: anonymous sign-ins, and Turnstile CAPTCHA protection. Captcha is the only abuse control on the anonymous sign-in endpoint, which is publicly reachable with the browser's publishable key, and it must never be disabled while anonymous sign-ins are on.

The path was verified live in production: PR #15 merged as `7c4009b`, the migration was applied first, and the owner completed the demo entry in a browser onto a seeded fictional ledger. Sanitized evidence is in [../deployment/production-judge-demo-evidence-2026-09-01.md](../deployment/production-judge-demo-evidence-2026-09-01.md).

Wave 5 evidence: all fourteen required WebMCP read/draft tools are implemented with AbortController lifecycle cleanup and no commit/delete/export/history/SQL tool. Local unit coverage is 9 files / 24 tests and ordinary-form browser regression remains 3 tests. In the supported in-app browser against the `codex/wave5-webmcp` Vercel preview, an isolated fictional user authenticated successfully; the daily and weekly seven-tool surfaces discovered, oversized input was rejected, draft mutations visibly recorded non-committing audit entries, and the tools disappeared off ritual routes. A direct ledger check confirmed the daily and weekly sessions remained drafts.

## Evidence already established

- PR #15 (`7c4009b`) merged the judge demo. All seven tracked Supabase migrations are applied to production, and remote error-level lint passes.
- PR #12 (`09f4fae`) merged Wave 6, including the reminder delivery RPC contract.
- Public signup and the demo entry point are Turnstile-protected, with the challenge verified by Supabase Auth. Browser-visible configuration contains only the Turnstile site key.
- The deployed `gyst-reminders` Worker has the UTC `*/15 * * * *` cron trigger. It is stateless; idempotency and delivery state live only in Supabase `notification_events`.
- Resend is connected and `geekindad.com` is verified. One approved real-recipient test was accepted and reported delivered. The test reached Gmail spam, so future sender-reputation/DMARC work remains an operational follow-up.
- Legacy Supabase JWT API keys are disabled. Production uses publishable/secret keys, kept in provider configuration only.
- Current local evidence passes 8 pgTAP files / 258 assertions, 17 Vitest files / 83 tests, app and Worker type checks, lint, production build, Worker dry-run, Supabase lint, and all five Playwright specs. Wave 6.5 adds owner-configured daily and weekly reminder schedules without broadening the Worker's ledger authority.
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
- ~~Fictional demo ledger and repeatable judge/demo account setup.~~ Delivered by the judge demo above.
- ~~Export and deletion behavior with ownership tests.~~ Local implementation and verification are complete; hosted migration/deployment and final release evidence still require approval.
- Full lint, type-check, unit, database, build, E2E, browser, secret, and private-data audit.
- Decide how the weekly page behaves early in the week. Weekly context is bounded to the current ISO week, so a judge arriving on a Monday sees one finding rather than five. The seeded prior week is complete; only the current-week view is thin.
- Approved release candidate, production verification, rollback evidence, demo video, and final submission copy.

## Submission boundary

Do not describe the current authenticated shell or production database foundation as a completed product. Do not create judge accounts, send real email, expose a preview, publish a video, submit competition materials, or make another production mutation without the corresponding approval gate.

All demo content must be fictional and must not reuse private personal context.
