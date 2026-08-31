# Submission Readiness

Last verified: 2026-08-30

Status: production database foundation deployed; product and submission evidence are not ready.

## Evidence already established

- Clean, reproducible Next.js/npm foundation with pinned runtime and dependency versions.
- Local Supabase reset, pgTAP, lint, and security-advisor workflow.
- Removal of the untracked hosted RLS helper and event trigger.
- Approved production application of the 11-table Wave 2 schema with RLS enabled, no `anon` table privileges, and operation-specific authenticated policies.
- Fresh local reset and all 120 pgTAP assertions pass; local and production error-level lint pass; production security advisors have no findings.
- Healthy production homepage at `https://gyst-web-mcp.vercel.app`; before PR #4, GitHub `main` was `c576e08` (documentation-only), while the active application behavior remains the A5/A9 baseline (`04851f5`).
- Browser-safe production Supabase URL and publishable-key configuration is complete. Authenticated daily and weekly route shells exist; unauthenticated production `/daily` now redirects to `/login`, not to configuration.
- Local-only Wave 3 work adds an ordinary daily draft form, atomic draft-save RPC, and validated invoker-only commit transaction. The selected human-only boundary is WebMCP capability—draft tools only, no commit tool—while the database protects owner isolation, atomic close/event creation, and immutability. The work has not passed the remaining W3 browser/independent-review evidence and is not merged, deployed, or approved for production.
- Local-only reminder Worker skeleton with successful dry runs.
- Ownership and approval rules recorded in `AGENTS.md` and the execution runbook.

## Required before submission

- Deliberate signup/confirmation strategy.
- Review, merge, and production-gate the local daily ritual, visible draft, and human-only atomic commit without weakening RLS or creating real users.
- Weekly context, findings, and review flow.
- WebMCP discovery and tool flows without commit or delete authority.
- Ordinary forms that remain fully usable without WebMCP.
- Fictional demo ledger and repeatable judge/demo account setup.
- Turnstile validation and abuse-path tests.
- Idempotent reminder delivery with approved Worker, Cron Trigger, and email configuration.
- Export and deletion behavior with ownership tests.
- Full lint, type-check, unit, database, build, E2E, browser, secret, and private-data audit.
- Approved release candidate, production verification, rollback evidence, demo video, and final submission copy.

## Submission boundary

Do not describe the current authenticated shell or production database foundation as a completed product. Do not create judge accounts, send real email, expose a preview, publish a video, submit competition materials, or make another production mutation without the corresponding approval gate.

All demo content must be fictional and must not reuse private personal context.
