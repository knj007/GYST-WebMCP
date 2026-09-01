begin;

select plan(26);

-- Two throwaway demo identities and one permanent identity. Claims are set as a
-- full JWT payload because the seed RPC reads the is_anonymous claim, which
-- auth.jwt() resolves only from request.jwt.claims.
insert into auth.users (id, email) values
  ('99999999-9999-4999-8999-999999999991', null),
  ('99999999-9999-4999-8999-999999999992', null),
  ('99999999-9999-4999-8999-999999999993', 'permanent-owner@example.test');

select ok(
  not (select prosecdef from pg_proc where oid = 'public.seed_demo_ledger()'::regprocedure),
  'demo seed RPC uses invoker authority and cannot bypass row-level security'
);
select ok(
  not has_function_privilege('anon', 'public.seed_demo_ledger()', 'execute'),
  'anon cannot seed a demo ledger'
);
select ok(
  has_function_privilege('authenticated', 'public.seed_demo_ledger()', 'execute'),
  'an authenticated session can seed a demo ledger'
);

set local role authenticated;

-- No identity at all.
select throws_ok(
  $$select public.seed_demo_ledger()$$,
  '42501',
  null::text,
  'an unauthenticated caller cannot seed a demo ledger'
);

-- A permanent account owns a real ledger and must never receive fiction.
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999993","role":"authenticated","is_anonymous":false}',
  true
);
select throws_ok(
  $$select public.seed_demo_ledger()$$,
  '42501',
  null::text,
  'a permanent account cannot seed fictional demo records'
);

-- First demo session.
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999991","role":"authenticated","is_anonymous":true}',
  true
);

-- A transaction-local GUC keeps the single seed result available to the
-- assertions below without needing table-creation privileges as this role.
select set_config('gyst_test.demo_seed', public.seed_demo_ledger()::text, true);

select is(
  (current_setting('gyst_test.demo_seed')::jsonb ->> 'seeded')::boolean,
  true,
  'a demo session seeds its own fictional ledger'
);
select is(
  current_setting('gyst_test.demo_seed')::jsonb ->> 'timezone',
  'America/Chicago',
  'the demo profile carries the fictional owner timezone'
);
select is(
  current_setting('gyst_test.demo_seed')::jsonb ->> 'week_start',
  (
    select (
      (now() at time zone 'America/Chicago')::date
      - (extract(isodow from (now() at time zone 'America/Chicago')::date)::integer - 1)
    )::text
  ),
  'the seeded week is the current week, not a fixed calendar date'
);
select cmp_ok(
  (current_setting('gyst_test.demo_seed')::jsonb ->> 'days_committed')::integer,
  '>=',
  5,
  'the demo ledger always carries a full prior week regardless of weekday'
);

select is(
  (select timezone from public.profiles where user_id = '99999999-9999-4999-8999-999999999991'),
  'America/Chicago',
  'the demo session receives a profile so weekly context can resolve its week'
);

-- Every seeded day is in the past. Today stays open for the demo session to
-- conduct and commit its own ritual.
select is(
  (
    select count(*) from public.ritual_sessions
     where kind = 'daily' and period_start >= (now() at time zone 'America/Chicago')::date
  ),
  0::bigint,
  'the seed never fabricates a ritual for today or any future day'
);
select is(
  (
    select count(*) from public.ritual_sessions
     where kind = 'daily' and status <> 'committed'
  ),
  0::bigint,
  'every seeded day is closed through the ordinary committed transition'
);

-- Commitment events exist only because the seed closes each day through the
-- same trigger path an owner uses, so the weekly findings have real history.
select cmp_ok(
  (select count(*) from public.commitment_events),
  '>=',
  5::bigint,
  'closing seeded days appends real commitment events through the ledger triggers'
);
select is(
  (
    select count(*) from public.commitment_events
     where event_on >= (now() at time zone 'America/Chicago')::date
  ),
  0::bigint,
  'no seeded commitment event is dated today or later'
);

-- The carried promise and the promise scored the next day must be the same
-- record, or the demo ledger tells a story whose causality does not close.
select is(
  (
    with closed_day as (
      select session.period_start, entry.previous_commitment_id, entry.next_commitment_id,
             lead(entry.previous_commitment_id) over (order by session.period_start) as next_day_scored
        from public.daily_entries as entry
        join public.ritual_sessions as session
          on session.user_id = entry.user_id and session.id = entry.ritual_session_id
       where session.kind = 'daily'
    )
    select count(*) from closed_day
     where next_day_scored is not null
       and next_commitment_id is distinct from next_day_scored
  ),
  0::bigint,
  'each seeded day carries the commitment the following day scores'
);

select is(
  (
    select status::text from public.ritual_sessions
     where kind = 'weekly'
       and period_start = (
         (now() at time zone 'America/Chicago')::date
         - (extract(isodow from (now() at time zone 'America/Chicago')::date)::integer - 1)
       ) - 7
  ),
  'committed',
  'last week is already closed so the demo ledger has weekly history'
);
select is(
  (
    select count(*) from public.ritual_sessions
     where kind = 'weekly'
       and period_start = (
         (now() at time zone 'America/Chicago')::date
         - (extract(isodow from (now() at time zone 'America/Chicago')::date)::integer - 1)
       )
  ),
  0::bigint,
  'the current weekly ritual is left open for the demo session to close'
);

-- Weekly context resolves and reports at least the date-driven finding on any
-- weekday. Outcome-driven findings accumulate as the seeded week progresses.
select is(
  (
    select count(*) from jsonb_array_elements(
      public.get_weekly_context(
        (
          (now() at time zone 'America/Chicago')::date
          - (extract(isodow from (now() at time zone 'America/Chicago')::date)::integer - 1)
        )
      ) -> 'findings'
    ) as finding
    where finding ->> 'type' = 'approaching_key_date'
  ),
  1::bigint,
  'the seeded key date is always inside the current weekly context window'
);

-- Re-running is a no-op. Committed records stay immutable; a clean slate comes
-- from taking a new anonymous identity instead.
select is(
  (select (public.seed_demo_ledger() ->> 'seeded')::boolean),
  false,
  'seeding twice does not rewrite an existing demo ledger'
);
select is(
  (select count(*) from public.areas),
  1::bigint,
  'a repeated seed call adds no duplicate ledger rows'
);

-- Second demo session: isolation is enforced by the existing owner-only
-- policies, not by anything this RPC does.
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999992","role":"authenticated","is_anonymous":true}',
  true
);

select is(
  (select count(*) from public.ritual_sessions),
  0::bigint,
  'a second demo session cannot see the first demo ledger'
);
select is(
  (select count(*) from public.commitment_events),
  0::bigint,
  'a second demo session cannot see the first commitment history'
);
select is(
  (select (public.seed_demo_ledger() ->> 'seeded')::boolean),
  true,
  'each demo session seeds an independent fictional ledger'
);
select cmp_ok(
  (select count(*) from public.ritual_sessions),
  '>=',
  6::bigint,
  'the second demo ledger is populated on its own'
);

reset role;

-- Scoped to the two demo identities: the local seed also populates a fictional
-- ledger in this database, and it must not be counted here.
select is(
  (
    select count(distinct user_id) from public.ritual_sessions
     where user_id in (
       '99999999-9999-4999-8999-999999999991',
       '99999999-9999-4999-8999-999999999992'
     )
  ),
  2::bigint,
  'the two demo ledgers are stored as separate owners'
);
select is(
  (
    select count(*) from public.commitments
     where user_id = '99999999-9999-4999-8999-999999999991'
       and title in (
         select title from public.commitments
          where user_id = '99999999-9999-4999-8999-999999999992'
       )
  ),
  4::bigint,
  'both demo ledgers carry the same fictional persona without sharing rows'
);

select * from finish();
rollback;
