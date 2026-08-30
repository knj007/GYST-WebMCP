# Database and RLS Guide

Last verified: 2026-08-30

## Current state

- Hosted project: `knj007's Project` (`ztxuxbjimssuxkazawxr`, `us-east-2`)
- PostgreSQL major version: 17 locally and remotely
- Supabase CLI used for verification: 2.116.0
- Hosted migration history: `20260830160046`, `20260830194920`
- Current local Wave 3 migration history: `20260830160046`, `20260830194920`, `20260830211216` (unreviewed and not hosted)
- Hosted security advisors: no findings
- Hosted performance advisors: 18 informational unused-index notices on the brand-new empty schema; no security or error finding
- Local application tables: 11 Wave 2 ledger tables with explicit RLS
- Hosted application tables: the same 11 Wave 2 ledger tables, all empty and RLS-enabled

The first migration removes the unversioned `ensure_rls` event trigger and `public.rls_auto_enable()` security-definer function. The accompanying pgTAP test proves that the trigger, function, and privileged implementation are absent.

This migration is remediation only. It does not establish the GYST ledger schema or claim that application RLS is complete.

The second migration, `20260830194920_wave2_application_schema.sql`, establishes the application schema. It was applied to the linked hosted project under explicit A2 approval on 2026-08-30, after a dry run confirmed it was the only pending migration. The sanitized before/after evidence packet is [production-wave2-evidence-2026-08-30.md](production-wave2-evidence-2026-08-30.md).

The current local Wave 3 migration, `20260830211216_daily_ritual_commit.sql`, adds the daily close transaction only. It is explicitly `SECURITY INVOKER`, retains normal RLS evaluation, grants `EXECUTE` only to `authenticated`, and uses an RLS-gated transaction-local marker for the validated draft-to-committed transition. It has not been reviewed, merged, or applied to the hosted project.

## Wave 2 application contract

The local ledger contains:

- `profiles`
- `areas`
- `goals`
- `key_dates`
- `commitments`
- `ritual_sessions`
- `daily_entries`
- `weekly_entries`
- `commitment_events`
- `reminder_rules`
- `notification_events`

Every table has a stable UUID primary key, a required `user_id`, a composite `(user_id, id)` ownership key, a positive version, and timezone-aware creation/update timestamps. Child relationships carry `user_id` in composite foreign keys. This makes cross-owner parent links fail at the constraint boundary rather than relying on application filtering.

The Data API surface is explicit:

- `anon` has no privileges on application tables.
- `authenticated` receives owner-filtered CRUD only where the ordinary application needs it.
- `profiles` cannot be deleted by the browser role.
- `commitment_events` are append-only for `authenticated` and have a trigger-level append-only guard.
- `notification_events` are read-only for `authenticated`; the later reminder worker will use a narrow server-side claim/reconciliation path.
- All policies are operation-specific. Updates have both `USING` and `WITH CHECK` predicates.

Authenticated users may create only draft ritual sessions, and ordinary updates must leave them in draft state with no commit timestamp. The local daily human-only commit transaction owns the validated draft-to-committed transition; it uses invoker authority, not a privilege bypass. Draft daily and weekly entries may be edited while their parent session is a draft. After a session is committed, RLS and private trigger functions prevent the session and its entry from being updated or deleted. Stable IDs and ownership columns cannot be changed.

Whole-account deletion remains possible through the `auth.users` cascade. A private Auth deletion trigger marks the affected user IDs transaction-locally, and immutable-ledger guards accept deletes only when both that marker and nested trigger depth prove the delete is part of the cascade. Standalone privileged deletes remain rejected even if the marker is spoofed.

Indexes cover every foreign-key prefix, every `user_id` RLS filter, bounded weekly lookups, approaching key dates, commitment-event history, due reminder rules, and notification reconciliation paths.

## Local Wave 2 and Wave 3 evidence

Verified on 2026-08-30 with Supabase CLI 2.116.0:

```text
supabase db reset --local --no-seed
Result: PASS; all three local migrations replayed.

supabase test db --local
Result: PASS; 4 files, 135 assertions.

supabase db lint --local --level error --fail-on error
Result: PASS; no schema errors.

supabase db advisors --local --type all --level info --fail-on error
Result: PASS; no security or error-level finding. After the pgTAP workload, the
database reports three informational unused-index notices for approaching key
dates, due reminder claims, and notification claims. Those future worker/query
paths are retained; representative application traffic does not exist yet.

supabase migration list --local
Result: PASS; local migrations 20260830160046, 20260830194920, and 20260830211216 are applied. Hosted Supabase remains at the first two only.

supabase gen types typescript --local --schema public
Result: PASS; the generated local `commit_daily_ritual` RPC signature matches the checked-in `src/lib/db/database.types.ts` update.
```

The pgTAP suites prove:

- all 11 tables exist, use RLS, carry ownership/version/timestamp columns, and expose composite ownership keys;
- every application foreign key has an index whose leading columns cover the complete foreign key;
- `anon` has no application table privilege and cannot select any ledger table;
- each authenticated owner sees only their own rows;
- cross-user reads, updates, and deletes are denied;
- cross-user inserts and cross-owner parent links are denied;
- valid owner CRUD succeeds only on the intended table operations;
- authenticated clients cannot insert already-committed sessions or manufacture/rewrite delivery history;
- authenticated clients cannot directly transition a draft session to committed;
- the authenticated daily commit RPC is `SECURITY INVOKER`, validates required fields, is cross-owner/stale-version safe, and returns an idempotent committed result without a duplicate event;
- committed daily/weekly sessions and entries are immutable;
- append-only commitment events and stable identifiers have trigger-level defense in depth.
- whole-account Auth deletion removes every owned row without weakening standalone immutable-ledger guards.

The local Wave 2 implementation did not mutate providers. After its evidence gate passed, the owner granted A2 approval for the single reviewed production migration. No provider configuration, secret write, user creation, production data insert, rollback, or RLS weakening occurred.

## Local workflow

Start the stack and rebuild it entirely from tracked migrations and seed files:

```bash
supabase start --ignore-health-check
supabase db reset
supabase test db
supabase db lint
supabase migration list --local
```

The empty `supabase/seed.sql` is intentional. Future seed data must be fictional, deterministic, and safe to delete.

Create every forward migration through the CLI:

```bash
supabase migration new descriptive_name
```

Do not invent migration timestamps, edit an already-applied migration, or use a remote database as the iteration environment.

## RLS acceptance contract

Before requesting the next remote migration gate, every user-owned table must have:

- RLS explicitly enabled in its migration.
- Ownership predicates tied to the authenticated user, not merely `TO authenticated`.
- `USING` and `WITH CHECK` coverage for updates where applicable.
- Negative pgTAP tests proving user A cannot read or mutate user B's rows.
- Tests proving anonymous and unauthenticated access is rejected where required.
- Explicit Data API grants reviewed separately from RLS.
- No browser access to service-role or other privileged keys.
- Clean reset, pgTAP, lint, advisors, and migration-list evidence.

Views must use `security_invoker` when exposed. Privileged functions must not be placed casually in `public`, and `SECURITY DEFINER` must never be used to bypass a policy failure.

## Remote boundary

Linked migration listing, advisors, and bounded read-only queries are inspection operations. A2 is complete for the initial Wave 2 schema only. Any corrective or additional hosted migration, Auth/config change, schema mutation, secret write, real-user creation, production data write, or destructive operation requires the applicable new approval gate in `docs/EXECUTION_RUNBOOK.md`.

Use forward-only corrective migrations for hosted changes. Never reset or rewrite the remote database to repair a release.
