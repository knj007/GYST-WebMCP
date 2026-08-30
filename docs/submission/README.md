# Submission Readiness

Last verified: 2026-08-30

Status: production database foundation deployed; product and submission evidence are not ready.

## Evidence already established

- Clean, reproducible Next.js/npm foundation with pinned runtime and dependency versions.
- Local Supabase reset, pgTAP, lint, and security-advisor workflow.
- Removal of the untracked hosted RLS helper and event trigger.
- Approved production application of the 11-table Wave 2 schema with RLS enabled, no `anon` table privileges, and operation-specific authenticated policies.
- Fresh local reset and all 120 pgTAP assertions pass; local and production error-level lint pass; production security advisors have no findings.
- Healthy production homepage at `https://gyst-web-mcp.vercel.app` on current `main` (`369733b`).
- Authenticated daily and weekly route shells exist, but production `/daily` intentionally redirects to configuration because browser-safe Supabase values are not yet configured.
- Local-only reminder Worker skeleton with successful dry runs.
- Ownership and approval rules recorded in `AGENTS.md` and the execution runbook.

## Required before submission

- Configure browser-safe production Supabase URL and publishable key only after the separate A5 evidence/approval gate; do not expose privileged keys.
- Deliberate signup/confirmation strategy.
- Complete daily ritual, visible draft, and human-only atomic commit.
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
