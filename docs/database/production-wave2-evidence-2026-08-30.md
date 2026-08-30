# Production Wave 2 Migration Evidence

Date: 2026-08-30

Project: `ztxuxbjimssuxkazawxr`
Approved scope: only `20260830194920_wave2_application_schema.sql`

## Before application

- Local `main`, `origin/main`, and GitHub `main` resolved to `369733b0f6eb50c1d9cf606b09b2e0a1c0b5b8ad`.
- Production migration history contained only `20260830160046_remediate_untracked_rls_helper`.
- Production `public` contained no application tables.
- Production security and performance advisors had no findings.
- A linked CLI dry run listed exactly one pending migration: `20260830194920_wave2_application_schema.sql`.

## Local gate evidence

- `supabase db reset` replayed both tracked migrations successfully.
- `supabase test db --local` passed: 3 files, 120 assertions.
- `supabase db lint --local --level error --fail-on error` returned no schema errors.
- Local advisors returned no security or error-level findings. The three informational unused-index notices are retained for approaching key dates, due reminder claims, and notification claims.
- The reviewed migration includes the draft/committed RLS boundary, trigger-level committed-record immutability, append-only commitment-event guard, and transaction-local Auth account-deletion cascade marker.

## Applied change

`supabase db push --linked` applied exactly `20260830194920_wave2_application_schema.sql`. No seeds, Auth users, application rows, provider configuration, secrets, or rollback operations were performed.

## After application

- Linked migration verification reports exactly `20260830160046` and `20260830194920` locally and remotely.
- Production contains all 11 expected empty ledger tables: `profiles`, `areas`, `goals`, `key_dates`, `commitments`, `ritual_sessions`, `daily_entries`, `weekly_entries`, `commitment_events`, `reminder_rules`, and `notification_events`.
- All 11 tables have RLS enabled. `anon` has no `SELECT`, `INSERT`, `UPDATE`, or `DELETE` privilege on any application table.
- `authenticated` grants match the reviewed surface: profile read/insert/update; owner CRUD for the mutable draft tables; read/insert only for append-only `commitment_events`; and read only for `notification_events`.
- The policy catalog contains 38 operation-specific policies, all targeted to `authenticated`; draft-session constraints and owner predicates are present for ritual and entry mutations.
- `supabase db lint --linked --level error --fail-on error` returned no schema errors.
- Production security advisors returned no findings. Production performance advisors returned 18 informational unused-index notices immediately after creating the empty schema; none is a security or error finding and each is expected to receive workload later.

## Remaining boundaries

- This A2 approval does not authorize another migration, remote configuration, secret write, production data write, user creation, email, deployment, rollback, or RLS change.
- Vercel production browser-safe Supabase values remain intentionally unconfigured and require their own evidence packet and approval.
