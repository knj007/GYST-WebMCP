# Database and RLS Guide

Last verified: 2026-09-01

## Current state

### Judge demo update — 2026-09-01

- `20260901035852_demo_ledger_seed.sql` adds `public.seed_demo_ledger()`, the fictional ledger used by the one-click judge demo.
- The RPC is `SECURITY INVOKER` and holds no elevated authority. It writes nothing the calling owner could not write through the ordinary application path, so the existing owner-only policies are what prove a demo session can only seed itself.
- It refuses a permanent account outright: seeding requires the `is_anonymous` JWT claim, so fiction can never be written into a real ledger.
- It refuses to overwrite an existing ledger. A demo session that wants a clean slate takes a new anonymous identity; committed records stay immutable, which is the same guarantee the product makes to every owner.
- Historical days are closed through the ordinary `draft -> committed` transition, so every seeded `commitment_events` row is appended by the existing ledger triggers rather than inserted directly.
- All dates derive from the demo profile timezone at call time. The seeded week is always the current week and no fixed calendar date appears in the migration.
- `supabase/seed.sql` no longer restates the fictional persona. It creates one anonymous local identity and calls the same RPC, so the local ledger and the deployed demo cannot drift.
- Anonymous sign-ins are enabled in `supabase/config.toml`. Anonymous users take the same `authenticated` Postgres role as permanent users, so all existing owner-only policies apply to them unchanged; no policy was added or relaxed.
- `070_demo_ledger_seed.test.sql` adds 25 assertions covering invoker authority, the permanent-account and unauthenticated refusals, relative dating, the untouched current day, cross-session isolation, and the repeat-seed no-op.
- Fresh local reset and pgTAP now pass 7 files / 239 assertions. Local error-level lint reports no schema errors.

### Wave 6 update — 2026-09-01

- PR #12 merged as `09f4fae`. All six tracked migrations are applied to the hosted project, including `20260901004116_reminder_delivery_rpc.sql`.
- The reminder migration adds a stateless service-role-only delivery contract: a bounded due-batch claim, pre-send active check, success/failure reconciliation, stale-claim recovery, planned-skip/opt-out cancellation, and recurrence calculation that preserves local wall time through daylight-saving transitions.
- `notification_events` remain the durable idempotency ledger. The unique `(reminder_rule_id, scheduled_for)` event is the duplicate guard; Resend receives the event ID as its idempotency key.
- No authenticated browser role can execute the reminder delivery RPCs. They are `SECURITY INVOKER`, granted only to `service_role`; the Worker has no direct table-write contract.
- Fresh local reset and pgTAP pass 6 files / 214 assertions. Local error-level lint and all advisors report no issues. Wave 6 app/Worker verification also passes 49 Vitest tests, type checks, lint, build, and Worker dry-run.
- Hosted project: `knj007's Project` (`ztxuxbjimssuxkazawxr`, `us-east-2`), PostgreSQL 17.

The first migration removes the unversioned `ensure_rls` event trigger and `public.rls_auto_enable()` security-definer function. The accompanying pgTAP test proves that the trigger, function, and privileged implementation are absent.

This migration is remediation only. It does not establish the GYST ledger schema or claim that application RLS is complete.

The second migration, `20260830194920_wave2_application_schema.sql`, establishes the application schema. It was applied to the linked hosted project under explicit A2 approval on 2026-08-30, after a dry run confirmed it was the only pending migration. The sanitized before/after evidence packet is [production-wave2-evidence-2026-08-30.md](production-wave2-evidence-2026-08-30.md).

The daily and weekly draft/commit migrations are merged and applied to the hosted project. Their RPCs are `SECURITY INVOKER`, retain normal RLS evaluation, and grant `EXECUTE` only to `authenticated`. The owner selected an application/WebMCP capability boundary: WebMCP has no commit tool, while the database validates every authenticated owner close and appends its matching stable outcome event in the same transaction.

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
- `notification_events` are read-only for `authenticated`; the deployed reminder Worker uses the narrow service-role claim/reconciliation RPC path described above.
- All policies are operation-specific. Updates have both `USING` and `WITH CHECK` predicates.

Authenticated users may create only draft ritual sessions, and ordinary updates must leave them in draft state with no commit timestamp except for a complete daily close. The local daily flow validates required fields and an active owner-owned next commitment at the trigger-level ledger boundary, appends the stable outcome event atomically, and marks the session committed. Draft daily saves write the session version and entry in one optimistic transaction. WebMCP remains limited by its draft-only tool contract rather than an unforgeable database claim about human origin. Draft daily and weekly entries may be edited while their parent session is a draft. After a session is committed, RLS and private trigger functions prevent the session and its entry from being updated or deleted. Stable IDs and ownership columns cannot be changed.

Whole-account deletion remains possible through the `auth.users` cascade. A private Auth deletion trigger marks the affected user IDs transaction-locally, and immutable-ledger guards accept deletes only when both that marker and nested trigger depth prove the delete is part of the cascade. Standalone privileged deletes remain rejected even if the marker is spoofed.

Indexes cover every foreign-key prefix, every `user_id` RLS filter, bounded weekly lookups, approaching key dates, commitment-event history, due reminder rules, and notification reconciliation paths.

## Historical Wave 2–4 evidence

Verified on 2026-08-30 with Supabase CLI 2.116.0:

```text
supabase db reset --local --no-seed
Result: historical PASS; this command pre-dates the Wave 6 reminder migration.

supabase test db --local
Result: historical PASS; Wave 6 supersedes this with 6 files / 214 assertions.

supabase db lint --local --level error --fail-on error
Result: PASS; no schema errors.

supabase db advisors --local --type all --level info --fail-on error
Result: PASS; no security or error-level finding. After the pgTAP workload, the
database reports three informational unused-index notices for approaching key
dates, due reminder claims, and notification claims. Those future worker/query
paths are retained; representative application traffic does not exist yet.

supabase migration list --local
Result: historical PASS; production now has all six tracked migrations through `20260901004116`.

supabase gen types typescript --local --schema public
Result: PASS; the generated local `commit_daily_ritual` RPC signature matches the checked-in `src/lib/db/database.types.ts` update.
```

Wave 4 adds owner-timezone bounded context, deterministic findings, a fictional local seed, and the ordinary weekly draft/commit flow. `npm test` passes 7 Vitest files / 20 tests and `npm run test:e2e` passes 3 Playwright tests, including weekly save, resume, commit, and immutable refresh. The seed uses only invented `.test` data and is applied only by local resets.

The pgTAP suites prove:

- all 11 tables exist, use RLS, carry ownership/version/timestamp columns, and expose composite ownership keys;
- every application foreign key has an index whose leading columns cover the complete foreign key;
- `anon` has no application table privilege and cannot select any ledger table;
- each authenticated owner sees only their own rows;
- cross-user reads, updates, and deletes are denied;
- cross-user inserts and cross-owner parent links are denied;
- valid owner CRUD succeeds only on the intended table operations;
- authenticated clients cannot insert already-committed sessions or manufacture/rewrite delivery history;
- authenticated clients cannot directly commit an incomplete, cross-owner, or non-daily draft; a complete owned daily session may close only through the reviewed normal application/database path;
- authenticated daily draft-save and close RPCs are `SECURITY INVOKER`; draft writes are atomic and stale-safe, daily close validates required fields and an active owner-owned next commitment, and idempotent replay does not create a duplicate close event;
- WebMCP's human-only boundary is its draft-only capability contract, not a database attempt to classify the origin of authenticated owner SQL;
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

`supabase/seed.sql` contains a deterministic, fictional, local-only weekly demo ledger. It uses a fixed `.test` identity and fixed dates/UUIDs, demonstrates every Wave 4 finding and exclusion, and must never be applied to the hosted project.

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
