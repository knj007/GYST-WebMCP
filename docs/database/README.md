# Database and RLS Guide

Last verified: 2026-08-30

## Current state

- Hosted project: `knj007's Project` (`ztxuxbjimssuxkazawxr`, `us-east-2`)
- PostgreSQL major version: 17 locally and remotely
- Supabase CLI used for verification: 2.116.0
- Local migration history: `20260830160046`, `20260830194920`
- Remote migration history: `20260830160046` only; the Wave 2 application migration has not been pushed
- Hosted security advisors: no warnings at the checkpoint
- Local application tables: 11 Wave 2 ledger tables with explicit RLS
- Hosted application tables: none yet

The first migration removes the unversioned `ensure_rls` event trigger and `public.rls_auto_enable()` security-definer function. The accompanying pgTAP test proves that the trigger, function, and privileged implementation are absent.

This migration is remediation only. It does not establish the GYST ledger schema or claim that application RLS is complete.

The second local migration, `20260830194920_wave2_application_schema.sql`, establishes the application schema. It remains local until the owner reviews the complete A2 evidence packet and explicitly approves a remote migration.

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

Authenticated users may create only draft ritual sessions. Draft daily and weekly entries may be edited while their parent session is a draft. After a session is committed, RLS and private trigger functions prevent the session and its entry from being updated or deleted. Stable IDs and ownership columns cannot be changed.

Indexes cover every foreign-key prefix, every `user_id` RLS filter, bounded weekly lookups, approaching key dates, commitment-event history, due reminder rules, and notification reconciliation paths.

## Wave 2 local evidence

Verified on 2026-08-30 with Supabase CLI 2.116.0:

```text
supabase db reset
Result: PASS; both tracked migrations replayed and the intentionally empty seed applied.

supabase test db --local
Result: PASS; 3 files, 114 assertions.

supabase db lint --local --level error --fail-on error
Result: PASS; no schema errors.

supabase db advisors --local --type all --level info --fail-on error
Result: PASS; no security or error-level finding. After the pgTAP workload, the
database reports three informational unused-index notices for approaching key
dates, due reminder claims, and notification claims. Those future worker/query
paths are retained; representative application traffic does not exist yet.

supabase migration list --local
Result: PASS; local migrations 20260830160046 and 20260830194920 are applied.

supabase gen types typescript --local --schema public
Result: PASS; src/lib/db/database.types.ts regenerated from the final local schema.
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
- committed daily/weekly sessions and entries are immutable;
- append-only commitment events and stable identifiers have trigger-level defense in depth.

No Wave 2 remote migration, provider configuration, secret write, user creation, push, or deployment occurred during this local database wave.

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

Linked migration listing, advisors, and bounded read-only queries are inspection operations. Any future `supabase db push`, hosted Auth/config change, schema mutation, secret write, real-user creation, or destructive operation requires the applicable approval gate in `docs/EXECUTION_RUNBOOK.md`.

Use forward-only corrective migrations for hosted changes. Never reset or rewrite the remote database to repair a release.
