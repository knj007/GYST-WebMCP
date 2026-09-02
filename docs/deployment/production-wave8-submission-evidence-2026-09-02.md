# Wave 8 Submission Release Evidence

Prepared: 2026-09-02
Release: `e5d664a` (PR #22), deployed to production from `main` and Ready
Scope: full pre-submission release gate — no production mutation was performed

This is the release audit required before the competition submission. It records the
complete verification pass against the deployed release. It applied no migration, changed
no provider configuration, wrote no secret, created no user, and sent no email.

## Source and verification

The verified tree is `e5d664a`, the tip of `main` and the exact commit serving production.
Local and remote migration histories match at nine migrations. No uncommitted application
change was included in the gate.

## Full release gate

Every check below was run on 2026-09-02 against `e5d664a`.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | Clean |
| App type check | `npm run typecheck` | Clean |
| Worker type check | `npm run typecheck:worker` | Clean |
| Unit tests | `npm run test` | 22 files / 101 tests passed |
| Production build | `npm run build` | Succeeded; 17 routes emitted |
| Worker dry-run | `npm run worker:dry-run` | 4.53 KiB, no bindings |
| Local database reset | `supabase db reset` | 9 migrations applied |
| Database tests | `supabase test db` | 9 files / 270 assertions passed |
| Local schema lint | `supabase db lint --level error` | No schema errors |
| Remote schema lint | `supabase db lint --linked --level error` | No schema errors |
| Migration parity | `supabase migration list --local` and `--linked` | 9/9 identical |
| End-to-end | `npm run test:e2e` | 6/6 passed |

The E2E suite covers the ordinary daily and weekly forms, route protection, owner-scoped
JSON/Markdown export against database fixture rows, and two judge-demo specs including a
two-visitor isolation check.

## Production verification

Read-only probes against `https://gyst-web-mcp.vercel.app`:

- `/` returns 200.
- `/daily` and `/weekly` return 307 to `/login` when unauthenticated.
- The homepage serves the pre-hydration WebMCP recovery surface (`gyst.get_status`,
  `gyst.open_daily_ritual`, `gyst.open_weekly_ritual`) and the Turnstile site key.
- The deployed commit is `e5d664a`, matching the reviewed SHA.

## Capability boundary

The WebMCP surface is fourteen ritual tools — seven daily, seven weekly — plus three
read-only status and navigation tools registered before hydration. All seventeen are
read-only or draft-only. There is no commit, delete, export, history, or SQL tool on any
route. `tests/unit/webmcp-capability-contract.test.ts` asserts the tool count, rejects any
`gyst.commit|delete|export|sql|history` name, confirms the commit RPC is absent from the
draft-save path, and pins the pre-hydration surface to read-only and navigation tools.

Export and account deletion are owner-scoped server routes reached from Settings. They are
deliberately absent from the WebMCP surface.

## Secret and private-data audit

- No secret appears in any tracked file. The only environment file ever added to history is
  `.env.example`, which contains keys with empty values.
- Client-reachable code references only `NEXT_PUBLIC_*` values: the Supabase URL, the
  Supabase publishable key, and the Turnstile site key.
- `.gitignore` excludes all environment files except the example, provider-local state,
  internal product assessments, local release-verification output, and vendored agent
  tooling.
- Demo content is fictional throughout and contains no personal context.

## Remaining operational follow-up

Carried forward unchanged; none blocks submission.

- Supabase Auth custom SMTP for confirmation delivery.
- Gmail deliverability: a monitor-only DMARC record and deliberate sending-domain warm-up.
- Production evidence of a naturally due reminder, without manufacturing ledger history.
- Production evidence of the ordinary Turnstile signup path.
- A deliberate isolated production account-deletion test.

## Rollback and safety

The prior production deployment remains available as a rollback candidate. Database
rollback is not permitted: corrective changes are forward-only migrations, and production
is never repaired by weakening RLS or exposing a privileged key.

Through the judging period the deployed release must remain reachable, and both hosted
Supabase Auth settings the judge demo depends on — anonymous sign-ins and Turnstile CAPTCHA
protection — must remain enabled.
