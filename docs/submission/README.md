# Submission Readiness

Last verified: 2026-08-30

Status: foundation deployed; product and submission evidence are not ready.

## Evidence already established

- Clean, reproducible Next.js/npm foundation with pinned runtime and dependency versions.
- Local Supabase reset, pgTAP, lint, and security-advisor workflow.
- Removal of the untracked hosted RLS helper and event trigger.
- Healthy baseline production deployment at `https://gyst-web-mcp.vercel.app`.
- Daily and weekly route shells reachable in production.
- Local-only reminder Worker skeleton with successful dry runs.
- Ownership and approval rules recorded in `AGENTS.md` and the execution runbook.

## Required before submission

- Authenticated application shell and deliberate signup/confirmation strategy.
- GYST ledger schema with explicit RLS and negative two-user isolation tests.
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

Do not describe the current static shell as a completed product. Do not create judge accounts, send real email, expose a preview, publish a video, submit competition materials, or change production without the corresponding approval gate.

All demo content must be fictional and must not reuse private personal context.
