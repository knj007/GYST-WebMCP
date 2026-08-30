# GYST WebMCP Execution Runbook

Status: execution in progress; Wave 2 production database foundation verified and deployed
Prepared: 2026-08-29
Last verified: 2026-08-30
Submission target: 2026-09-03 at 1:00 p.m. Pacific / 3:00 p.m. Central
Repository: `knj007/GYST-WebMCP`
Supabase project: `knj007's Project` (`ztxuxbjimssuxkazawxr`, `us-east-2`)
Production: `https://gyst-web-mcp.vercel.app`

## 1. Objective

Execute the competition-first GYST WebMCP plan with a four-slot operating model:

1. One root orchestrator that owns shared files, integration, commits, external writes, and release gates.
2. One database/security agent that owns Supabase schema, migrations, RLS, RPCs, and database tests.
3. One application/WebMCP agent that owns the Next.js ritual experience, application services, and site-tool behavior.
4. One infrastructure/release agent that owns Vercel, Cloudflare Worker/Turnstile, Resend, CI, and release evidence.

The product claim remains:

> The agent can read the week, conduct the ritual, and prepare the record. Only the person can decide what becomes part of the ledger.

The execution must preserve these non-negotiables:

- Supabase is the only durable application ledger.
- Every user-owned table is protected by tested RLS.
- WebMCP can update drafts but cannot commit or delete the ledger.
- The ordinary form remains fully usable without WebMCP.
- Demo data is fictional and contains no copied personal context.
- Vercel hosts the Next.js application.
- Cloudflare provides Turnstile and a stateless scheduled reminder Worker, not a second database.

## 2. Authoritative starting state (historical)

This section preserves the evidence available when the runbook was prepared. It is not the current project status; use section 2.1 and the focused guides under `docs/` for the latest verified state.

Verified before this runbook was written:

- The local folder is a clean Git repository on `main`, tracking `origin/main`.
- `origin` is `https://github.com/knj007/GYST-WebMCP.git`.
- The repository remote targets `knj007`, but the current `gh` tokens for both `knj007` and `GeekinDad` are invalid. GitHub CLI must be reauthenticated before any push or remote-management step.
- The original public commit records a personal Gmail address as its author email. The owner must explicitly choose whether to accept that existing public history or authorize a one-commit history rewrite before further public commits. The address is intentionally not repeated in this tracked runbook.
- The repository currently contains only `LICENSE`.
- The direct Supabase connector sees `knj007's Org` and one healthy project named `knj007's Project`.
- The project ref is `ztxuxbjimssuxkazawxr` and Postgres is 17.
- Supabase CLI 2.75.0 is installed. It must be upgraded to 2.81.3 or newer before relying on `supabase db advisors`; MCP advisors are the fallback.
- Node 24.13.0 and npm 11.8.0 are installed. The repository/CI/runtime Node version must be selected and pinned during A0 rather than inheriting the machine default accidentally.
- No Docker-compatible runtime is installed, so local Supabase start/reset/pgTAP work is blocked until A0 approves that prerequisite or an equivalent isolated runtime.
- The direct Supabase connector and Supabase CLI are separate authentication contexts. CLI authentication and project linking are not yet verified.
- Vercel, Cloudflare, Turnstile, and Resend account/project state are not yet verified.
- Vercel CLI and Wrangler are not currently installed, and the repository has no `.vercel`, Wrangler, Supabase link, GitHub Actions, or application configuration yet.
- The live Supabase project has no application tables and no migration history, but it is not pristine: `public.rls_auto_enable()` is an externally callable `SECURITY DEFINER` function, and the enabled `ensure_rls` DDL event trigger calls it. Supabase security advisors currently report two external-facing warnings. The first reviewed migration must remove this untracked helper/trigger and replace it with explicit table-by-table RLS.

The earlier product plan remains the product specification. This runbook is the execution/control layer and does not replace the product decisions in that plan.

### 2.1 Current execution checkpoint — 2026-08-30

- Local `main`, `origin/main`, and GitHub `main` resolve to `369733b0f6eb50c1d9cf606b09b2e0a1c0b5b8ad` before this documentation update; the prior foundation deployment at `b6ba3ea` is historical evidence only.
- The repository contains a strict TypeScript Next.js 16.3.3 App Router application with Tailwind, ESLint, Vitest, Playwright, a committed npm lockfile, and Node 24.x runtime metadata.
- The application has a marketing page, sign-in flow, Supabase SSR clients, centralized `getClaims()` authorization, and request-dynamic authenticated daily/weekly route shells. It does not yet contain the ritual forms, atomic human-only commit, WebMCP tools, reminders, or demo ledger.
- Docker Desktop and Supabase CLI 2.116.0 are available. The local Postgres 17 stack starts successfully with analytics disabled, and all core containers are running.
- Both tracked migrations are present locally and in production: `20260830160046_remediate_untracked_rls_helper.sql` and `20260830194920_wave2_application_schema.sql`.
- The untracked `ensure_rls` event trigger and `public.rls_auto_enable()` function are absent locally and remotely. A fresh reset and all 120 pgTAP assertions pass. Production has all 11 application tables with RLS enabled, zero `anon` application-table grants, and 38 operation-specific `authenticated` policies matching the reviewed migration.
- Local and production error-level database lint pass. Production security advisors have no findings. The local post-pgTAP advisor run has three documented informational unused-index notices; the new empty production schema reports 18 informational unused-index notices and no security/error finding.
- Vercel's Git integration automatically deployed current `main`. The homepage is healthy; `/daily` redirects to `/login?reason=configuration` because browser-safe Supabase URL/publishable-key values remain unconfigured under their separate production configuration gate.
- The Vercel CLI session was signed out and reauthenticated after credential-hygiene remediation. No credential value belongs in repository documentation or command output.
- The Cloudflare Worker skeleton is configured for staging and production names and has passed dry runs. No Worker, Cron Trigger, or Turnstile widget has been created remotely.
- Vercel's Git integration deploys `main`, but repository CI workflows have not been added yet.
- Resend and production email are not configured. No real email or real-user creation has been authorized.
- Completed external scopes: remediation migration, `main` push, baseline production deployment, and A2 application of only `20260830194920_wave2_application_schema.sql`. Later remote migrations/configuration, secrets, resources, pushes, and deployments still require their applicable one-time gates.

Focused current-state guides:

- `docs/database/README.md`
- `docs/deployment/README.md`
- `docs/submission/README.md`

## 3. Operating model

### 3.1 Root orchestrator

The root orchestrator is the only agent permitted to:

- Edit shared hotspots: `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, root config files, and `AGENTS.md`.
- Stage files, create commits, push branches, open pull requests, or merge.
- Request host-level escalations or persistent command-prefix approvals.
- Create or link remote projects and integrations.
- Write or rotate secrets.
- Apply migrations to the remote Supabase project.
- Create preview or production deployments.
- Send real email or create/delete real users.
- Declare a wave complete.

The orchestrator maintains the current plan, assigns bounded tasks, resolves shared-file conflicts, integrates results, and records evidence.

### 3.2 Database/security lane

Primary ownership:

```text
supabase/
  config.toml
  migrations/
  tests/
  seed.sql
docs/database/
```

Responsibilities:

- Schema, constraints, indexes, ownership columns, and enums.
- RLS policies for anonymous and authenticated roles.
- Parent/child ownership constraints that prevent cross-user references.
- Draft/commit transactions and reminder-claim RPCs.
- pgTAP tests, database lint, migration verification, and advisors.
- Sanitized seed data design.

This lane may propose generated TypeScript types but does not overwrite an application-owned type file without an orchestrator handoff.

### 3.3 Application/WebMCP lane

Primary ownership:

```text
src/app/
src/components/
src/lib/auth/
src/lib/db/
src/lib/rituals/
src/lib/commitments/
src/lib/export/
src/lib/webmcp/
tests/unit/
tests/e2e/
```

Responsibilities:

- Next.js App Router layouts, routes, Server Components, Server Actions, and Route Handlers.
- Supabase SSR/browser clients and cookie session flow.
- Shared ritual services used by both forms and WebMCP tools.
- Daily and weekly draft experiences.
- Human-only commit controls.
- Bounded weekly-context and pattern presentation.
- WebMCP tool registration lifecycle and progressive enhancement.
- Unit, route, accessibility, and end-to-end tests.

### 3.4 Infrastructure/release lane

Primary ownership:

```text
workers/reminders/
.github/workflows/
docs/deployment/
docs/submission/
```

Responsibilities:

- Read-only account/team/project discovery for Vercel and Cloudflare.
- Vercel project/linking plan and environment matrix.
- Cloudflare Worker, Cron Trigger, Turnstile, and secret-name contract.
- Resend integration plan and test-domain path.
- CI workflows and deployment checks.
- Preview/production verification, release checklist, and submission evidence.

This lane drafts external changes. The orchestrator performs the actual remote writes after a human gate.

### 3.5 Shared-worktree collision rules

All agents share one worktree, so concurrency is file-ownership based rather than branch based.

- Subagents do not run `git checkout`, `git switch`, `git stash`, `git reset`, `git clean`, `git add`, `git commit`, or `git push`.
- A task must name its allowed paths and forbidden shared files.
- Two agents may not edit the same path in the same wave.
- Changes to shared manifests are sent as a requested diff or dependency list; the orchestrator applies them.
- Generated artifacts are created only after the orchestrator confirms the destination is not owned by another active lane.
- The orchestrator checks `git diff` before and after every agent handoff.

## 4. Approval policy

Auto-approval has two layers:

1. **Agent autonomy:** routine, local, reversible work proceeds without asking again.
2. **Host approval rules:** when the sandbox requires approval, the owner may persist narrowly scoped command prefixes. The runbook cannot bypass host security controls.

Official OpenAI guidance recommends explicitly allowing in-scope local edits and validation while retaining confirmation for external, destructive, costly, or scope-expanding actions.

### 4.1 Automatically authorized work

The following work may proceed without a new conversational approval when it is inside this repository and inside an assigned lane:

- Read files and inspect Git status, diffs, history, and configuration.
- Search source and documentation.
- Create or edit repository files within the assigned path set.
- Format source files.
- Run local lint, type-check, unit, database, and end-to-end tests.
- Run local builds.
- Start or stop local development processes.
- Generate local types and other reproducible artifacts.
- Run read-only provider/account/project inspection.
- Fix failures inside the assigned scope and rerun the failed check.
- Delete disposable test artifacts created by the same task after validating their exact paths.
- Create local commits after the wave evidence gate passes; only the orchestrator stages and commits.

### 4.2 Candidate persistent host prefixes

When the host prompts for approval, the owner may choose persistent approval only for these narrow categories. The exact executable path may vary on Windows.

| Purpose | Candidate prefix | Conditions |
| --- | --- | --- |
| Reproduce dependencies | `npm ci` | Only after a reviewed lockfile exists. |
| Lint | `npm run lint` | Script must be reviewed in `package.json`. |
| Type-check | `npm run typecheck` | Script must be reviewed in `package.json`. |
| Unit tests | `npm run test` | Script must be reviewed in `package.json`. |
| E2E tests | `npm run test:e2e` | Local/preview target only; no destructive fixtures. |
| Production-shape build | `npm run build` | Local build only. |
| Supabase status | `supabase status` | Local/read-only. |
| Supabase database tests | `supabase test db` | Local stack only. |
| Supabase lint | `supabase db lint` | Local by default; `--linked` needs an explicit gate. |
| Supabase local migration list | `supabase migration list --local` | Read-only. |
| Generate local DB types | `supabase gen types` | Output path reviewed by orchestrator. |
| Vercel identity/project inspection | `vercel whoami`, `vercel projects ls`, `vercel env ls` | Read-only; never print values. |
| Pull Vercel development env | `vercel env pull` | Correct project verified; destination is ignored; values never printed. |
| Cloudflare identity inspection | `wrangler whoami` | Read-only. |
| Worker local types/dev | `wrangler types`, `wrangler dev` | Local environment only. |
| Worker validation | `wrangler deploy --dry-run` | Must remain a dry run. |

Do not persist broad prefixes such as `git`, `npm`, `npx`, `supabase`, `vercel`, `wrangler`, PowerShell, or Python. Broad prefixes would also authorize destructive or external operations.

### 4.3 Bounded standing approvals for external preview work

The owner may grant these standing approvals once the named scope is verified. They are not implied merely by approving this plan:

- Push non-force feature branches matching `codex/*` only to `knj007/GYST-WebMCP`.
- Open or update pull requests from those branches without merging them.
- Allow Vercel's Git integration to create Preview deployments automatically from those branches.
- Update non-production Vercel variables containing browser-safe or official test values.
- Deploy a non-production Worker that has no production secrets and no Cron Trigger.

These standing approvals never cover `main`, force pushes, merges, production deployments, remote migrations, secret writes, real email, billing, domains, or public submission. The orchestrator reports each external preview write in the wave-close evidence.

### 4.4 One-time approval gates

Each item below requires explicit owner approval at the moment it is ready, even if similar work was approved earlier:

| Gate | Approval required for | Evidence shown before approval |
| --- | --- | --- |
| A-1 | GitHub reauthentication and the original-commit email/privacy decision | Current failed auth status, public commit author metadata, rewrite/no-rewrite consequences. |
| A0 | Initial framework/dependency installation and any CLI upgrade | Exact packages, pinned versions, install command, expected files. |
| A0b | Docker-compatible runtime installation | Exact installer/source, disk/network impact, verification and removal path. |
| A1 | Supabase CLI login/link to `ztxuxbjimssuxkazawxr` | Current CLI identity/profile, target org/project/ref, clean worktree. |
| A2 | First remote Supabase migration push | Migration list, local reset, pgTAP results, lint, advisors, schema diff. |
| A3 | Vercel project creation/link and GitHub integration | Account/team, project name, repository, environment names. |
| A4 | Cloudflare Worker/Turnstile resource creation | Account, resource names, schedules, domains, cost-impact statement. |
| A5 | Adding or rotating Vercel/Cloudflare/Resend/Supabase secrets | Secret names and destinations only; values never displayed. |
| A6 | Sending a real email or creating the remote judge account | Recipient/domain, sanitized content, cleanup plan. |
| A7 | Establish the first preview pipeline or share a preview outside the approved project team | Commit SHA, checks passed, target environment, known issues. Later `codex/*` previews may use the bounded standing approval. |
| A8 | Production database/config mutation after the first baseline | SQL/config diff, backups/recovery, tests, impact. |
| A9 | Production deployment, DNS/domain changes, or public release | Release candidate SHA, full verification report, rollback target. |
| A10 | Git push, pull request merge, tag, release, or submission | Commits, diff summary, checks, destination branch/repository. |

Purchases, paid-plan upgrades, billing changes, destructive deletion, credential revocation, and production data deletion always require separate explicit approval.

### 4.5 Never auto-approved

- `git reset --hard`, `git clean -fd`, forced push, history rewrite, or broad recursive deletion.
- Dropping/resetting the remote database or deleting a Supabase project.
- Printing, committing, logging, or messaging a secret value.
- `supabase db push`, `vercel deploy`, `vercel --prod`, `wrangler deploy`, or `wrangler secret put` without the applicable gate.
- Disabling RLS, weakening policies to make a test pass, or placing a secret/service key in `NEXT_PUBLIC_*`.
- Creating `SECURITY DEFINER` functions as a permission workaround.
- Giving WebMCP a commit, delete-history, unrestricted-query, or private-export tool.
- Copying real personal data into seeds, screenshots, logs, fixtures, or demo output.

## 5. Agent task contract

Every delegated task must include:

```text
Objective:
Allowed paths:
Forbidden paths/shared files:
Inputs and assumptions:
Required implementation:
Required tests/evidence:
Commands allowed:
External actions forbidden:
Stop conditions:
Handoff format:
```

Every agent handoff must report:

- Outcome and remaining risk.
- Files changed.
- Commands run and exit status.
- Tests passed/failed/skipped.
- Assumptions made.
- Shared-file changes requested from the orchestrator.
- Next-lane contract or blocker.

An agent stops rather than improvising when it encounters a production secret, ambiguous remote target, destructive action, schema-contract conflict, or scope expansion.

## 6. Execution waves

### Wave 0 — Control plane and reproducible baseline

Target: 2026-08-29, first block
Lead: orchestrator
Parallel support: all three lanes perform read-only preflight

Tasks:

1. Commit this runbook and add a concise `AGENTS.md` containing the lane ownership and approval policy.
2. At A-1, reauthenticate GitHub CLI as `knj007` and decide whether the original public personal-email author metadata is accepted or rewritten before adding more history.
3. Add `.gitignore` entries before any local environment or provider metadata is created.
4. Detect Node/npm, Docker, Supabase CLI, Vercel CLI, and Wrangler versions and installation sources.
5. Verify Supabase CLI identity separately from the working direct connector.
6. Upgrade Supabase CLI to at least 2.81.3 or record MCP advisors as the temporary fallback.
7. Install Vercel CLI and Wrangler only through the reviewed A0 dependency/tool packet.
8. Inspect Vercel and Cloudflare identities/teams without creating anything.
9. Decide exact resource names before remote creation:
   - Vercel: `gyst-webmcp`
   - Cloudflare Worker: `gyst-reminders`
   - Turnstile widget: `gyst-signup`
10. Establish `.env.example` with names only:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `TURNSTILE_SECRET_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `RESEND_API_KEY`
   - `REMINDER_FROM_EMAIL`
11. Capture live Supabase drift evidence: empty table/migration lists, `ensure_rls`, `rls_auto_enable()`, and both advisor warnings.
12. Decide Auth confirmation strategy for the competition: custom SMTP, or a deliberate prototype configuration behind Turnstile. Changing hosted Auth/SMTP settings requires an explicit remote-config gate.

Evidence gate W0:

- Clean Git diff except reviewed baseline files.
- Tool/version matrix recorded.
- Correct GitHub and direct Supabase targets confirmed.
- GitHub CLI reauthentication and initial-commit email decision recorded.
- Vercel/Cloudflare current identities reported.
- No secrets exist in tracked files or terminal output.
- Docker/local-Supabase readiness is proved or explicitly blocked at A0b.
- The untracked Supabase trigger/function has a reviewed, forward migration remediation plan.
- Approval gates A0/A1/A3/A4 are clearly queued, not silently crossed.

### Wave 1 — Framework, local Supabase, and infrastructure skeletons

Target: 2026-08-29, second block
Lead: orchestrator
Parallel lanes: database/security, application/WebMCP, infrastructure/release

Orchestrator tasks:

1. At A0, scaffold a current Next.js App Router application with strict TypeScript, ESLint, Tailwind, `src/`, and npm. Because the workspace folder name contains `+`, scaffold into a verified temporary child such as `scaffold-next`, inspect it, move its contents into the repository root, and delete only that exact resolved temporary path.
2. Review dependency versions, then commit the lockfile.
3. Add reviewed scripts for lint, type-check, unit tests, E2E tests, and build.
4. Initialize Supabase locally with the CLI.
5. At A1, authenticate/link CLI to project `ztxuxbjimssuxkazawxr`.
6. Keep the brand-new remote schema untouched until Wave 2 passes locally.

Database lane:

- Create the first migration using `supabase migration new`, never a hand-invented timestamp. It must harmlessly drop the untracked `ensure_rls` event trigger and revoke/drop `public.rls_auto_enable()` before application tables are added.
- Define the schema contract and a pgTAP test plan.
- Establish the sanitized seed contract.

Application lane:

- Create the application shell, route groups, error/loading boundaries, and test harness.
- Add no database-dependent feature until generated/shared contracts are handed off.

Infrastructure lane:

- Create local-only Worker skeleton and `wrangler.jsonc` with no plaintext secrets.
- Draft Vercel environment mapping and CI workflows without deploying.
- Validate the Worker locally and with a dry run.

Evidence gate W1:

- `npm ci`, lint, type-check, tests, and build succeed on the scaffold.
- Supabase local stack starts, or the exact Docker/local blocker is documented.
- `supabase migration list --local` is clean and reproducible.
- Worker type generation and dry run succeed.
- No remote deployment or migration has occurred.

### Wave 2 — Secure database foundation and authenticated app shell

Target: 2026-08-29 through early 2026-08-30
Lead: database/security
Parallel: application auth shell; infrastructure CI

Database lane deliverables:

1. Drift cleanup:
   - Drop `ensure_rls` with `IF EXISTS`.
   - Revoke execution and drop `public.rls_auto_enable()`.
   - Preserve the finding/remediation in the evidence report.
   - Use explicit RLS in versioned migrations rather than another automatic DDL trigger.
2. Tables:
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
3. Required enums/check constraints, timestamps, stable IDs, version columns, and foreign keys.
4. Composite `(user_id, id)` ownership keys and child foreign keys that make cross-owner parent links impossible.
5. Index every foreign key and expected weekly/reminder access path.
6. Enable RLS on every exposed table.
7. Explicitly grant only the required table operations to `authenticated`; grant no ledger access to `anon`. Do not assume new tables are automatically exposed through the Data API.
8. Add operation-specific policies with ownership predicates and both `USING` and `WITH CHECK` for updates.
9. Add pgTAP suites for:
   - Anonymous denial.
   - Owner CRUD as appropriate.
   - Cross-user read/update/delete denial.
   - Cross-user insert/parent-link denial.
   - Committed-record immutability boundaries.
10. Add database lint and advisors to the verification report.

Application lane deliverables:

- Supabase browser/server clients using the publishable key only.
- Cookie-backed session handling using the current pinned `@supabase/ssr` API.
- A centralized server authorization helper that validates claims on secure reads/actions; proxy/middleware redirects remain a convenience, not the security boundary.
- Sign-in page and authenticated layout.
- Server-side initial read pattern and authorization redirects.
- No public signup yet; Turnstile lands in Wave 6.

Infrastructure lane deliverables:

- Database test CI workflow that starts local Supabase and runs pgTAP.
- Application CI workflow for lint/type-check/unit/build.

Evidence gate W2 / approval A2:

- Fresh local database reset applies every migration.
- All pgTAP tests pass.
- Database lint passes at error level.
- Advisors contain no unresolved critical/security finding, or each finding has an approved disposition.
- The two current `rls_auto_enable()` security warnings are gone after the approved cleanup migration.
- Generated types match the migration.
- Two-user isolation is proven by negative tests, not inferred from policy text.
- Only after this evidence may the owner approve the first remote migration push.

### Wave 3 — Daily ritual and atomic human commit

Target: 2026-08-30
Lead: application/WebMCP
Support: database/security

Deliverables:

1. Shared daily service functions for start/resume, autosave, review, and commit.
2. Six-beat daily form:
   - What moved.
   - What blocked, with required blocker type.
   - Score yesterday's stable commitment.
   - Set tomorrow's one action.
   - Optional context/buried win/sensitivity.
   - Human close/commit.
3. Versioned draft updates that reject stale writes.
4. One atomic commit transaction that validates required fields, appends commitment events, and marks the session committed.
5. Idempotency for repeated commit clicks.
6. Committed sessions cannot be mutated through draft services.
7. Normal form works without WebMCP or JavaScript site-tool support.

Evidence gate W3:

- Unit tests cover daily rules and blocker typing.
- Integration tests prove autosave/resume and stale-version rejection.
- Transaction tests prove atomicity and idempotency.
- E2E test signs in, completes a day, refreshes, and sees committed data.
- A code search confirms no WebMCP or server action can bypass the human commit path.

### Wave 4 — Weekly context, patterns, and demo ledger

Target: 2026-08-30
Lead: database/security and application/WebMCP in parallel

Database lane:

- Implement bounded Monday-Sunday weekly-context query in the user's timezone.
- Implement structured findings using stable IDs/events:
  - Repeated partial/deferred/not-done commitment.
  - Blocker type appearing at least three times.
  - Buried win reproduced exactly.
  - Work outside stated priorities.
  - Approaching dates within 21 days.
- Exclude planned skips from misses and external gates from avoidant-stall findings.
- Seed one sanitized fictional week that guarantees the demo findings.

Application lane:

- Weekly read-before-ask page.
- Visible shared draft for missing metrics, observations, decision, arrow, and dated priorities.
- Human-only weekly commit using version and idempotency protections.
- Concise context view; do not send unrestricted history to an agent.

Evidence gate W4:

- Deterministic tests cover every required finding and every exclusion rule.
- Editing a commitment title does not reset staleness.
- Buried-win text is preserved verbatim.
- Seed contains no real names, private financial details, or copied career context.
- A full weekly flow works through ordinary controls.

### Wave 5 — WebMCP progressive enhancement

Target: 2026-08-31
Lead: application/WebMCP
Independent reviewer: database/security

Daily read tools:

- `gyst.get_daily_context`
- `gyst.review_daily_draft`

Daily draft tools:

- `gyst.record_moved`
- `gyst.record_blocker`
- `gyst.score_previous_commitment`
- `gyst.set_next_commitment`
- `gyst.record_optional_context`

Weekly read tools:

- `gyst.get_weekly_context`
- `gyst.review_weekly_draft`

Weekly draft tools:

- `gyst.record_missing_metric`
- `gyst.record_weekly_observation`
- `gyst.set_weekly_decision`
- `gyst.set_weekly_arrow`
- `gyst.set_weekly_priority`

Implementation requirements:

- Register tools only on authenticated active ritual routes.
- Use an `AbortController` to unregister on route change and sign-out.
- Use narrow schemas, enums, and maximum string lengths.
- Mark read tools with `readOnlyHint: true`.
- Reuse the same ritual services as the form; do not duplicate business rules.
- Every mutation says it updated a draft and did not commit.
- Show recent agent-made draft changes visibly in the UI.
- Never expose commit, delete-history, unrestricted SQL/history, or broad private-export tools.

Evidence gate W5:

- Tool discovery succeeds in the supported in-app browser.
- Tools appear/disappear with route and auth lifecycle.
- Invalid/oversized inputs are rejected.
- Tool mutations update only drafts.
- The agent cannot commit through any registered tool.
- Ordinary form E2E tests still pass with WebMCP unavailable.

### Wave 6 — Signup protection and reminder delivery

Target: 2026-09-01
Leads: infrastructure/release and database/security
Support: application/WebMCP

Turnstile/signup:

1. At A4, create the Turnstile widget for the approved domains.
2. Put the site key in browser-safe configuration and the secret only in encrypted server configuration.
3. Verify tokens server-side before invoking Supabase Auth signup.
4. Reject missing, invalid, expired, and reused tokens.
5. Reset the widget after failed attempts.

Reminder Worker:

1. Configure one UTC Cron Trigger: `*/15 * * * *`.
2. Implement a typed `scheduled()` handler.
3. Call one narrow Supabase RPC that claims a bounded due batch.
4. Use unique `(reminder_rule_id, scheduled_for)` events as the authoritative duplicate guard.
5. Send short neutral email through Resend.
6. Record `sent` or `failed`; advance `next_run_at` only after reconciliation.
7. Keep Worker state stateless; no D1, KV, or R2.
8. Test locally through Wrangler's scheduled-handler test route.

Evidence gate W6 / approvals A4-A6:

- Two overlapping scheduled invocations result in one claimed send.
- Replaying the same schedule does not duplicate a successful notification.
- Timezone and daylight-saving tests pass.
- Planned skips and opt-out suppress sends.
- Failed sends are logged and safely retriable.
- Turnstile negative/positive tests pass.
- Secret scans show no secret values in source, bundles, logs, or exports.
- Owner approves resource creation, secret placement, and the first real test email separately.

### Wave 7 — Ownership, exports, and deletion

Target: 2026-09-01
Lead: application/WebMCP
Security review: database/security

Deliverables:

- `gyst-portable-v1` complete JSON export with schema version and export timestamp.
- Human-readable Markdown export of committed daily and weekly records.
- CSV/ZIP only if schedule allows.
- Export includes drafts only when explicitly requesting a full backup.
- Export contains no API keys, session tokens, provider secrets, or unrelated private context.
- Account deletion signs out/revokes sessions, removes Auth identity and owned rows, and reports completion.

Evidence gate W7:

- Ownership tests compare export row counts to database ownership.
- Markdown rendering is reviewed for readability and sanitization.
- Another user cannot export or delete the owner's data.
- Destructive deletion is tested locally before any remote test and always requires a human gate remotely.

### Wave 8 — Verification, preview, production, and submission

Target: 2026-09-02; 2026-09-03 is buffer only
Lead: orchestrator and infrastructure/release
Reviewers: all lanes

Verification order:

1. Fresh clone/install with the committed lockfile.
2. Fresh local Supabase start/reset.
3. Database tests, lint, advisors, migration list.
4. Unit tests, type-check, lint, production build.
5. E2E daily and weekly normal-form flows.
6. WebMCP discovery and complete weekly flow in the in-app browser.
7. Reminder overlap/idempotency and Turnstile tests.
8. JSON/Markdown export and deletion tests.
9. Repository secret/history scan and private-data audit.
10. At A7, create a preview deployment and rerun the demo flow.
11. Fix only evidence-backed defects; rerun the smallest failed check and then the full release gate.
12. At A9/A10, deploy the exact reviewed SHA to production and push/tag the release.
13. Record a public sub-three-minute demo and prepare submission text.

Rollback plan:

- Keep the last known-good Vercel deployment available for rollback.
- Use forward-only corrective Supabase migrations; do not rewrite applied history.
- Disable the Cloudflare Cron Trigger before changing reminder schema/contracts.
- Roll back Worker code independently from the Supabase ledger.
- Rotate any secret suspected of exposure before continuing.
- Never repair a release by disabling RLS or using a browser-exposed secret.

## 7. Compressed calendar

The original Friday foundation window has passed, so foundation and daily work overlap without overlapping file ownership.

| Date | Must finish | Parallel lanes |
| --- | --- | --- |
| Sat 2026-08-29 | Waves 0-2: control plane, scaffold, local Supabase, first secure migration, authenticated shell | DB schema/RLS; app shell/auth; Worker/CI skeleton |
| Sun 2026-08-30 | Waves 3-4: daily ritual, weekly context/patterns, fictional demo ledger | Daily UI/services; weekly SQL/tests; demo UI |
| Mon 2026-08-31 | Wave 5: WebMCP contracts and supported-browser proof | Tool implementation; adversarial review; E2E |
| Tue 2026-09-01 | Waves 6-7: Turnstile, reminders, Resend, exports, deletion | Worker/RPC; signup; exports/security |
| Wed 2026-09-02 | Wave 8: full verification, preview, production, video, submission draft | Release audit; browser demo; assets |
| Thu 2026-09-03 | Buffer only; submit no later than 3:00 p.m. Central | Submission-blocking fixes only |

## 8. Cut order

If time slips, cut in this order:

1. CSV/ZIP export; retain JSON and Markdown.
2. Public signup polish; retain working Auth and judge credentials.
3. Full goals-management UI; retain seeded goals and relational links.
4. Multiple reminder channels; retain one email path.
5. Daily WebMCP demo; retain ordinary daily form and excellent weekly WebMCP flow.
6. Generic ritual customization UI; retain code-level `gyst_v1` defaults.

Never cut:

- Seeded weekly history.
- Cross-day pattern detection.
- Visible shared draft.
- Human-only commit.
- RLS isolation.
- Normal form without WebMCP.
- Public live URL, source repository, license, and demo video.

## 9. Completion evidence matrix

The project is complete only when every row below has direct evidence.

| Requirement | Authoritative evidence |
| --- | --- |
| Judge can sign in; new user can sign up through Turnstile | Production E2E/video plus server logs showing verified flow without secret exposure. |
| Weekly page loads fictional committed week | Seed migration/fixture and production screenshot/E2E assertion. |
| ChatGPT discovers weekly WebMCP tools | In-app browser recording and tool-list assertion. |
| Required structured findings appear | Deterministic database/unit tests plus demo output. |
| Agent asks for missing fact and updates visible draft | Browser E2E/recording and persisted draft row. |
| Agent prepares decision, arrow, and priorities | Draft-tool E2E and visible UI state. |
| Agent cannot commit | Absence of commit tool, negative tool test, and successful human-only UI commit test. |
| Human commit persists across refresh/device | Production E2E with reload/new session. |
| Another user cannot access rows | pgTAP negative tests and application-level two-user test. |
| Reminder delivers once and is logged | Overlap/replay test, one provider delivery, one database event. |
| JSON and Markdown exports work | Fixture comparison, schema-version assertion, downloaded artifacts. |
| Submission package is complete | Live URL, public repo, license, description, video, and final checklist. |

No requirement is considered complete based only on source inspection, a plausible plan, or one narrow passing test.

## 10. Coordination cadence

At the start of each wave, the orchestrator posts:

- Current SHA and worktree state.
- Wave objective and exact exit gate.
- Active agent/path assignments.
- Pending human approvals.
- Known risks and timebox.

During a wave:

- Agents send concise evidence-based updates at meaningful boundaries.
- The orchestrator does not poll unchanged work repeatedly.
- A failed check is assigned to one owner.
- After two or three failed variants, stop retrying and reconsider the approach.
- New user input is evaluated as either a replacement or an addition before work continues.

At wave close, the orchestrator records:

- Files and commits.
- Exact checks and results.
- Remote changes made.
- Secrets/resources touched by name only.
- Remaining risks and next handoffs.
- Whether the wave's evidence gate is proved, contradicted, or incomplete.

## 11. First executable batch

Once the owner says to execute this runbook, begin with this bounded batch:

1. Add `AGENTS.md`, `.gitignore`, and `.env.example` under the policy above.
2. Present A-1 for GitHub reauthentication and the original-commit email/privacy decision.
3. Inspect local tool versions/auth and identify the Supabase CLI, Vercel CLI, and Wrangler installation/upgrade paths.
4. Inspect Vercel and Cloudflare identities read-only after their CLIs are available.
5. Present approval packet A0 for framework/dependency/tool installation.
6. Scaffold Next.js through the verified temporary child and commit the lockfile after approval.
7. Initialize local Supabase and present A1 for CLI link.
8. Spawn the three lanes with Wave 1 path ownership.
9. Stop before the first remote database mutation and present the complete A2 evidence packet.

## 12. Reference baseline

- OpenAI model guidance: https://developers.openai.com/api/docs/guides/latest-model
- Supabase local development and migrations: https://supabase.com/docs/guides/local-development/database-migrations
- Supabase testing and linting: https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- Supabase RLS testing overview: https://supabase.com/docs/guides/local-development/testing/overview
- Next.js App Router: https://nextjs.org/docs/app
- Vercel CLI/project deployment: https://vercel.com/docs/deployments
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
