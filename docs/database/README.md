# Database and RLS Guide

Last verified: 2026-09-02

## Current state

### Wave 9 onboarding — 2026-09-02 (local branch `codex/wave9-onboarding`, not applied to the hosted project)

- `20260902231606_wave9_onboarding.sql` is local only. It requires a new remote migration gate and must not reach the hosted project before the 2026-09-03 submission gate closes.
- `profiles.onboarded_at timestamptz` is the onboarding gate. The migration backfills it once for every existing profile that owns at least one commitment or one committed ritual session; after that the column alone decides. A missing profile row counts as not onboarded.
- `public.onboarding_drafts` is the founding statement: one row per owner (`user_id` unique, cascading from `auth.users`), `draft jsonb` (object), `status public.ritual_status`, `version`, `committed_at`, and `founding_commitment_id` with a composite `(user_id, founding_commitment_id)` foreign key to `commitments`. RLS is owner-only: select own, insert own draft, update own while in draft (the `WITH CHECK` allows the draft-to-committed transition, as the ritual policy does). There is no delete policy and no delete grant; `anon` has nothing. A private guard trigger makes a committed row immutable except inside a whole-account deletion cascade.
- The fan-out lives at the ledger boundary. `gyst_private.complete_onboarding_commit()` fires on the draft-to-committed transition and, in that one statement, validates the draft, inserts `areas`, `goals`, `key_dates`, and `commitments`, appends one `created` event per commitment, creates the completed founding commitment titled `Founded this GYST ledger`, upserts the profile with the explicit timezone and display name, and sets `onboarded_at`. Any failure raises `22023` (shape or content) or `23514` (no active commitment) and rolls the whole transition back, so a direct authenticated `UPDATE ... SET status = 'committed'` cannot skip validation any more than the RPC can.
- `save_onboarding_draft(p_draft jsonb, p_expected_version bigint default null)` and `commit_onboarding(p_onboarding_draft_id uuid, p_expected_version bigint)` are a `SECURITY INVOKER` pair mirroring the daily split: the save never commits, caps the payload at 256 KiB (`22023`), requires the current version once a row exists (`40001`), and refuses a committed row (`23514`); the commit requires a non-null matching version (`40001`), returns the same values idempotently on replay, and reports a foreign or unknown draft as `42501`. Both refuse an `is_anonymous` identity with `42501`, as `delete_my_account()` does, so a demo session can never found a real ledger. The draft timezone must match a `pg_timezone_names.name` exactly; POSIX forms such as `UTC+5` are rejected because Postgres reads their sign inverted and the application cannot format them.
- `add_commitment(p_goal_id uuid, p_title text, p_details text default null, p_due_on date default null)` is the owner-scoped pump: it inserts one active commitment under an owned active goal and exactly one `created` event dated in the owner's profile timezone (`UTC` when no profile row exists). A goal that is not owned or does not exist is `42501`; a non-active goal is `23514`; bad text is `22023`. Granted to `authenticated` only; WebMCP never receives it.
- `seed_demo_ledger()` is re-created with the same fictional persona and now sets `onboarded_at`, so a demo session never meets the gate. Its `already_prepared` guard now also returns early when the caller owns any `areas`, `goals`, `commitments`, or `onboarding_drafts` row, so it can never seed on top of rows created another way. The commit's profile upsert preserves an existing `onboarded_at`.
- Two pure validators, `gyst_private.onboarding_draft_text` and `gyst_private.onboarding_draft_date`, are executable by `authenticated` for the same reason the weekly validator is: the invoker-authority trigger calls them under the owner role, and they read no table.
- `100_onboarding.test.sql` adds 151 assertions: invoker authority and grants, `anon` and demo-session refusal, cross-owner isolation of the draft and the commit, draft saves that never commit, the size cap, optimistic concurrency, atomic rejection of a dangling key, an over-long title, zero commitments, an unknown, missing, or POSIX timezone, colliding keys, a bad priority and a malformed date, the complete founding commit with resolved relations and events, the existing-profile upsert path, immutability of the committed row, the day-one daily close against the founding commitment, `add_commitment` behaviour including a demo session, the backfill predicate, the demo seed gate and its refusal to seed over an existing draft, and whole-account cascade through the founding statement. Fresh local reset and pgTAP pass 10 files / 421 assertions; local lint reports no finding at any level.
- `src/lib/db/database.types.ts` was regenerated once for the new table, column, and RPCs. The generator cannot infer nullability of `returns table` columns, so the three hand-written annotations on `save_ritual_reminder_schedule` are maintained by the application lane.

### Wave 7 ownership and deletion release — 2026-09-01

- PR #19 merged as `2b3571d`; migration `20260901155949_add_account_deletion_rpc.sql` is applied to the hosted project, and remote migration history plus error-level lint are clean. Git-integrated production deployment is Ready.
- The migration adds `public.delete_my_account()`: a zero-argument `SECURITY DEFINER` function with an empty search path, granted only to `authenticated`. It obtains its target solely from `auth.uid()`, refuses an `is_anonymous` JWT claim, and deletes the caller's Auth identity.
- The RPC reuses the existing `auth.users` cascade marker and immutable-ledger guards. It does not grant a browser role direct Auth-table access or direct delete capability over ledger tables; committed-row cascade remains limited to a whole-account delete transaction.
- `090_account_deletion_rpc.test.sql` proves authenticated-only execution, demo rejection, self-only deletion, owner-child cascade, and that another owner's rows remain. Local evidence passes 9 pgTAP files / 270 assertions; unit, browser, build, and local export-isolation checks passed before release. No production user was created or deleted to exercise the destructive flow.

### Wave 6.5 reminder-schedule update — 2026-09-01

- `20260901135156_ritual_reminder_schedule.sql` is applied to the hosted project. It adds a narrow, owner-invoker `save_ritual_reminder_schedule()` RPC and an `is_ritual_schedule` marker so user-configured ritual schedules cannot collide with existing commitment or session reminder rules.
- Each owner may maintain one daily and one weekly ritual schedule. The RPC derives cadence from ritual kind, reads the stored profile timezone, calculates a future local-wall-time occurrence, and allows a paused schedule to retain its preferred time without a due run.
- The RPC is executable only by `authenticated`; `anon` has no execute privilege. New pgTAP coverage proves invoker authority, owner isolation, pause/resume behavior, weekly weekday validation, and future-run calculation. Fresh local reset now passes 8 files / 258 assertions; hosted migration history and error-level lint pass.

### Judge demo update — 2026-09-01

- `20260901035852_demo_ledger_seed.sql` is applied to the hosted project and adds `public.seed_demo_ledger()`, the fictional ledger used by the one-click judge demo. All seven tracked migrations match the hosted history and remote error-level lint reports no schema errors.
- The RPC is `SECURITY INVOKER` and holds no elevated authority. It writes nothing the calling owner could not write through the ordinary application path, so the existing owner-only policies are what prove a demo session can only seed itself.
- It refuses a permanent account outright: seeding requires the `is_anonymous` JWT claim, so fiction can never be written into a real ledger.
- It refuses to overwrite an existing ledger. A demo session that wants a clean slate takes a new anonymous identity; committed records stay immutable, which is the same guarantee the product makes to every owner.
- Historical days are closed through the ordinary `draft -> committed` transition, so every seeded `commitment_events` row is appended by the existing ledger triggers rather than inserted directly.
- All dates derive from a fixed demo timezone evaluated at call time, which the RPC also writes into the demo profile so the application and the seed agree on the day. The seeded week is always the current week and no fixed calendar date appears in the migration.
- Each seeded day carries the commitment the following day scores, so the promise/kept chain closes; a pgTAP assertion enforces it. The last closed day hands its action to the open day.
- Anonymous identities are never cleaned up automatically. See the retention section in `docs/deployment/README.md`.
- `supabase/seed.sql` no longer restates the fictional persona. It creates one anonymous local identity and calls the same RPC, so the local ledger and the deployed demo cannot drift.
- Anonymous sign-ins are enabled in `supabase/config.toml`. Anonymous users take the same `authenticated` Postgres role as permanent users, so all existing owner-only policies apply to them unchanged; no policy was added or relaxed.
- `070_demo_ledger_seed.test.sql` adds 26 assertions covering invoker authority, the permanent-account and unauthenticated refusals, relative dating, the untouched current day, cross-session isolation, and the repeat-seed no-op.
- Fresh local reset and pgTAP now pass 7 files / 240 assertions. Local error-level lint reports no schema errors.

### Wave 6 update — 2026-09-01

- Historical Wave 6 statement, superseded above: PR #12 merged as `09f4fae`, and six tracked migrations were applied to the hosted project, including `20260901004116_reminder_delivery_rpc.sql`.
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
- `onboarding_drafts` (Wave 9, local branch)

Every table has a stable UUID primary key, a required `user_id`, a composite `(user_id, id)` ownership key, a positive version, and timezone-aware creation/update timestamps. Child relationships carry `user_id` in composite foreign keys. This makes cross-owner parent links fail at the constraint boundary rather than relying on application filtering.

The Data API surface is explicit:

- `anon` has no privileges on application tables.
- `authenticated` receives owner-filtered CRUD only where the ordinary application needs it.
- `profiles` cannot be deleted by the browser role.
- `onboarding_drafts` cannot be deleted by the browser role, and a committed draft cannot be updated by anyone outside a whole-account deletion cascade.
- `commitment_events` are append-only for `authenticated` and have a trigger-level append-only guard.
- `notification_events` are read-only for `authenticated`; the deployed reminder Worker uses the narrow service-role claim/reconciliation RPC path described above.
- All policies are operation-specific. Updates have both `USING` and `WITH CHECK` predicates.

Authenticated users may create only draft ritual sessions, and ordinary updates must leave them in draft state with no commit timestamp except for a complete daily close. The local daily flow validates required fields and an active owner-owned next commitment at the trigger-level ledger boundary, appends the stable outcome event atomically, and marks the session committed. Draft daily saves write the session version and entry in one optimistic transaction. WebMCP remains limited by its draft-only tool contract rather than an unforgeable database claim about human origin. Draft daily and weekly entries may be edited while their parent session is a draft. After a session is committed, RLS and private trigger functions prevent the session and its entry from being updated or deleted. Stable IDs and ownership columns cannot be changed.

Whole-account deletion remains possible through the `auth.users` cascade. A private Auth deletion trigger marks the affected user IDs transaction-locally, and immutable-ledger guards accept deletes only when both that marker and nested trigger depth prove the delete is part of the cascade. Standalone privileged deletes remain rejected even if the marker is spoofed.

For Wave 7, the ordinary UI invokes only `delete_my_account()` after deliberate confirmation. The database function has no user ID argument, takes the caller from `auth.uid()`, and rejects demo identities. The application clears Supabase session cookies after the identity is removed; no service-role key is introduced into the browser or application export/deletion path.

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
Result: historical PASS; production now has all seven tracked migrations through `20260901035852`.

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
