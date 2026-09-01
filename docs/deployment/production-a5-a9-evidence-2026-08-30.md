# Production Browser-Safe Supabase Activation Evidence

Date: 2026-08-30

> Historical evidence only. This preserves the narrow A5/A9 activation record; current Wave 6 state is documented in [production-wave6-evidence-2026-09-01.md](production-wave6-evidence-2026-09-01.md).

Targets: Vercel team `knj007`, project `gyst-web-mcp`, Production environment; Supabase project `ztxuxbjimssuxkazawxr`

Approved scope: A5 configuration of the two browser-safe Supabase values and A9 redeploy of the existing Git-integrated production artifact. No other remote mutation was in scope.

## Before activation

- GitHub `main` resolved to `04851f557d24d4c43d65106ba5f4beb302613191`.
- Vercel Production had no configured environment-variable names for this application.
- The Supabase project endpoint was verified and its key inventory contained exactly one enabled modern publishable key. Key values were neither displayed nor recorded.
- The existing production artifact was selected for rebuild rather than deploying the local worktree, which contains unrelated untracked daily-ritual work.

## Applied changes

- Added `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the Vercel Production environment only.
- Rebuilt the selected existing production artifact with Vercel CLI 59.10.0, creating production deployment `dpl_7mMaHMK7Xa1KD5skxBTNnEuEYfiX`.
- No secret/service-role key, other Vercel variable, Supabase schema/configuration, Auth user, production application row, email, deployment source change, or rollback was created.

## After activation

- The deployment reached `Ready` and is assigned to `https://gyst-web-mcp.vercel.app`.
- A public `HEAD /` check returned 200.
- A public unauthenticated `HEAD /daily` check returned 307 with `Location: /login`; the former `?reason=configuration` redirect is absent.
- No authentication attempt, user creation, or production data write was needed for verification.

## Remaining boundaries

- This completes A5 only for the two named browser-safe values and A9 only for this rebuild. Any further production environment/configuration write or deployment needs a new evidence packet and explicit approval.
- Signup/confirmation strategy, daily/weekly ritual implementation, human-only commit flow, WebMCP draft tools, reminders, Turnstile, Resend, demo data, and user-facing end-to-end testing remain unfinished.
