# Database and RLS Guide

Last verified: 2026-08-30

## Current state

- Hosted project: `knj007's Project` (`ztxuxbjimssuxkazawxr`, `us-east-2`)
- PostgreSQL major version: 17 locally and remotely
- Supabase CLI used for verification: 2.116.0
- Local and remote migration history: `20260830160046`
- Hosted security advisors: no warnings at the checkpoint
- Application tables: none yet

The first migration removes the unversioned `ensure_rls` event trigger and `public.rls_auto_enable()` security-definer function. The accompanying pgTAP test proves that the trigger, function, and privileged implementation are absent.

This migration is remediation only. It does not establish the GYST ledger schema or claim that application RLS is complete.

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
