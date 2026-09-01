# Judge Demo Production Release Evidence

Date: 2026-09-01

Scope: the one-click judge demo, the fictional ledger RPC behind it, and the Supabase Auth configuration approved for that release. Secret values are intentionally omitted.

## Source and verification

- PR #15 merged to `main` as `7c4009b` after Vercel checks passed.
- Local release verification passed: 240 pgTAP assertions across 7 files, 75 Vitest tests across 16 files, app and Worker type checks, lint, production build, Worker dry-run, and Supabase lint.
- Playwright passed 3 of 5 specs. The two failures are the pre-existing draft-save defect recorded below, reproduced on `main` with this branch's application changes removed.
- An adversarial review of the branch found no blocker in privilege, isolation, or seed date arithmetic, and confirmed the human-only commit and draft-only WebMCP boundaries still hold for an anonymous session. Its should-fix findings were addressed in `5774e8e` before merge.

## Applied provider changes

- Supabase applied forward-only migration `20260901035852_demo_ledger_seed.sql`. All seven tracked migrations match the hosted history and remote error-level lint reports no schema errors.
- Supabase Auth has anonymous sign-ins enabled. Anonymous users take the same `authenticated` Postgres role as permanent users, so the existing owner-only policies apply to them unchanged. No policy was added, relaxed, or rewritten for the demo.
- Supabase Auth has CAPTCHA protection enabled with the Turnstile provider. The Turnstile secret is held in Supabase Auth configuration only; the browser receives only the site key.
- Turnstile verification no longer runs in the application. `TURNSTILE_SECRET_KEY` is not an application variable and can be removed from Vercel.

## Verification performed against production

Captcha enforcement, before the merge. All three probes were rejected and created no user:

| Probe | Result |
| --- | --- |
| Anonymous signup, invalid token | `captcha_failed` — `invalid-input-response` |
| Anonymous signup, no token | `captcha_failed` — `no captcha_token found` |
| Email signup, no token | `captcha_failed` — `no captcha_token found` |

Cloudflare returning `invalid-input-response` rather than `invalid-input-secret` also confirms the configured Turnstile secret is valid.

After the deploy:

- The homepage serves the demo entry point and loads the Turnstile widget with the site key only.
- `POST /api/demo/start` rejects an invalid token and an empty body with `400`, creating no identity.
- The owner completed the demo entry in a browser: a real widget token produced an anonymous session that landed on the daily ritual with its seeded fictional ledger. That single path exercises captcha issuance, anonymous sign-in, the seeding RPC, and owner-scoped reads together, and is the authoritative check for anonymous sign-in status because captcha runs ahead of the provider check and hides it from `curl`.

## Demo ledger boundaries

- `public.seed_demo_ledger()` is `SECURITY INVOKER` and holds no elevated authority. It writes nothing the calling owner could not write through the ordinary application path.
- It requires the `is_anonymous` claim, so fiction cannot be written into a permanent account's ledger.
- It declines rather than overwriting when a ledger already exists. A demo session that wants a clean slate takes a new anonymous identity; committed records stay immutable.
- Seeded days are closed through the ordinary `draft -> committed` transition, so every commitment event is appended by the existing ledger triggers.
- All dates derive from a fixed demo timezone evaluated at call time. No calendar date is hard-coded, so the seeded week is always the current week.

## Remaining operational follow-up

- Remove the now-unused `TURNSTILE_SECRET_KEY` from Vercel Production.
- Anonymous identities are never cleaned up automatically. Purge stale demo identities on the schedule recorded in `README.md` under "Anonymous identity retention".
- Pre-existing defect, unrelated to this release: saving a daily or weekly draft persists correctly but renders no confirmation message. It is the sole cause of the two failing Playwright specs.
- Weekly context is bounded to the current ISO week, so the weekly view is thin early in the week. The seeded prior week is complete.

## Rollback and safety

- Correct database behavior with a new forward-only migration; never rewrite applied migrations or weaken RLS.
- Disabling anonymous sign-ins in Supabase Auth withdraws the demo without a deploy. The entry point then reports that the demo is unavailable and no other flow is affected.
- Never disable the Supabase Auth captcha while anonymous sign-ins are enabled. That combination fails open on both signup and anonymous sign-in, and no application, test, or CI check can observe it.
- Roll back application code independently from the Supabase ledger.
- Rotate any suspected secret exposure before continuing.
