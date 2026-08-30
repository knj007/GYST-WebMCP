# GYST WebMCP

GYST is a human-owned daily and weekly ritual ledger. The application can help read context and prepare drafts, while only the person can commit a record.

## Local foundation

Requirements: Node.js 24, npm 11, Docker Desktop, and Supabase CLI 2.116.0 or newer.

```bash
npm ci
npm run dev
```

The application runs at `http://127.0.0.1:3000`. Copy `.env.example` to an ignored local environment file when application integrations are added; never commit provider values.

Local checks:

```bash
npm run lint
npm run typecheck
npm run typecheck:worker
npm run test
npm run build
npm run test:e2e
supabase test db
```

See `docs/EXECUTION_RUNBOOK.md` for the ownership model, approval gates, and release evidence requirements.
