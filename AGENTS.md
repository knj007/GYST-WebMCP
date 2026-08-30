# GYST WebMCP Agent Rules

Follow `docs/EXECUTION_RUNBOOK.md`. Supabase is the only durable application ledger; WebMCP may edit drafts but must never commit or delete ledger records.

## Ownership

- Root orchestrator: shared/root configuration, package manifests and lockfiles, Git staging/commits, external writes, secrets, deployments, and release gates.
- Database/security: `supabase/` and `docs/database/`; schema, migrations, RLS, RPCs, seeds, pgTAP, lint, and advisors.
- Application/WebMCP: `src/`, `tests/unit/`, and `tests/e2e/`; App Router UI, services, auth clients, human-only commit flows, and WebMCP progressive enhancement.
- Infrastructure/release: `workers/reminders/`, `.github/workflows/`, `docs/deployment/`, and `docs/submission/`; Worker, CI, provider mapping, and release evidence.

Only the root orchestrator edits shared manifests/configuration or performs Git operations. Preserve unrelated work and coordinate before crossing another lane's paths.

## Approval boundaries

Local, reversible repository edits and local lint, type-check, tests, builds, generators, and development services are authorized. Read-only provider inspection is authorized.

Stop and obtain explicit owner approval before any remote migration or schema/config mutation, secret write or rotation, resource creation, deployment, push/merge/tag/release, real email, real-user creation, purchase, destructive action, history rewrite, or force-push. Never print or commit secrets, disable RLS to pass a check, expose privileged keys in `NEXT_PUBLIC_*`, or deploy from an unverified commit.

Use forward-only Supabase migrations created with `supabase migration new`. Prove every user-owned table's RLS with negative cross-user tests before requesting a remote migration gate.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
