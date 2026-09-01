# Wave 6 Production Release Evidence

Date: 2026-09-01

Scope: Turnstile-protected signup, stateless reminder delivery, and the provider configuration approved for that release. Secret values are intentionally omitted.

## Source and verification

- PR #12 merged to `main` as `09f4fae` after Vercel checks passed.
- Local release verification passed: 49 Vitest tests, 214 pgTAP assertions, app and Worker type checks, lint, production build, Worker dry-run, and Supabase lint/advisors.
- The deployed Worker health endpoint returned `{"service":"gyst-reminders","status":"ok"}`.

## Applied provider changes

- Supabase applied forward-only migration `20260901004116_reminder_delivery_rpc.sql`; all six tracked migrations match the hosted history.
- Cloudflare Turnstile protects public signup. Its secret remains server-only in Vercel; only the site key is browser-visible.
- Cloudflare Worker `gyst-reminders` is deployed with Cron Trigger `*/15 * * * *` (UTC). It is stateless and has no D1, KV, or R2 binding.
- Cloudflare secrets are configured by name only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `REMINDER_FROM_EMAIL`.
- Resend is connected to Vercel Production. `geekindad.com` is verified and the approved From address is server-only Worker configuration.
- A single approved test message to the approved recipient was accepted and later reported `delivered` by Resend. It was a provider test, not a fabricated ledger notification.
- The old Supabase legacy JWT `anon` and `service_role` keys are disabled. Production uses the current publishable/secret key model.

## Remaining operational follow-up

- Confirm an actual due reminder traverses the deployed claim/reconciliation path; do not manufacture ledger history for that purpose without a new approval.
- Review Gmail placement after the new-domain test. SPF and DKIM are configured; a monitor-only DMARC decision remains separate DNS work.
- Custom SMTP for Supabase Auth confirmation remains tracked separately.

## Rollback and safety

- Correct database behavior with a new forward-only migration; never rewrite applied migrations or weaken RLS.
- Disable the Cloudflare Cron Trigger before changing the reminder schema or contract.
- Roll back Worker code independently from the Supabase ledger.
- Rotate any suspected secret exposure before continuing.
