# Demo and account conversion tracking

The project is on Vercel Hobby. Vercel Web Analytics page views are free, but custom events require Pro or Enterprise, so the application does not ship a custom event SDK that would silently do nothing.

Conversion counts are available from existing Supabase Auth and ledger records. Run this read-only query in the Supabase SQL editor for project `ztxuxbjimssuxkazawxr`:

```sql
select
  count(*) filter (where u.is_anonymous is true and rs.user_id is not null) as demo_openings,
  count(*) filter (where u.is_anonymous is false) as accounts_created
from auth.users u
left join (select distinct user_id from public.ritual_sessions) rs on rs.user_id = u.id;
```

`demo_openings` counts anonymous users who completed the demo seed and reached a ritual session. `accounts_created` counts permanent Supabase Auth users. These are durable server records, include activity from any client, and do not expose email addresses or ritual contents. They are aggregate counts only; failed attempts leave no count, and Auth's anti-enumeration responses intentionally make duplicate signup attempts indistinguishable.

The current hosted aggregate was 16 demo users and 5 permanent Auth users when last checked on 2026-09-07. Vercel Web Analytics is enabled for free page views at [Analytics](https://vercel.com/knj007/gyst-web-mcp/analytics). No Vercel plan upgrade was made.

References: [Vercel custom events](https://vercel.com/docs/analytics/custom-events), [Vercel setup](https://vercel.com/docs/analytics/quickstart).
