begin;

select plan(15);

insert into auth.users (id, email)
values
  ('33333333-3333-4333-8333-333333333333', 'daily-owner@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'daily-other@example.test');

insert into public.profiles (user_id)
values
  ('33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444');

insert into public.commitments (id, user_id, title)
values
  ('c3000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'Yesterday action'),
  ('c3000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'Tomorrow action');

insert into public.ritual_sessions (id, user_id, kind, period_start)
values
  ('d3000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'daily', '2026-08-30'),
  ('d3000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'daily', '2026-08-31'),
  ('d4000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'daily', '2026-08-30');

insert into public.daily_entries (
  user_id, ritual_session_id, moved_text, blocker_text, blocker_type,
  previous_commitment_id, previous_commitment_outcome, next_commitment_id
)
values
  ('33333333-3333-4333-8333-333333333333', 'd3000000-0000-4000-8000-000000000001', 'Closed the proposal', 'Awaiting review', 'external_gate', 'c3000000-0000-4000-8000-000000000001', 'done', 'c3000000-0000-4000-8000-000000000002'),
  ('33333333-3333-4333-8333-333333333333', 'd3000000-0000-4000-8000-000000000002', 'Draft two', null, null, 'c3000000-0000-4000-8000-000000000001', 'partial', 'c3000000-0000-4000-8000-000000000002');

select ok(
  not (select prosecdef from pg_proc where oid = 'public.commit_daily_ritual(uuid, bigint, uuid)'::regprocedure),
  'daily commit transaction uses invoker authority and keeps RLS in force'
);
select ok(
  not has_function_privilege('anon', 'public.commit_daily_ritual(uuid, bigint, uuid)', 'execute'),
  'anonymous callers cannot execute the commit transaction'
);
select ok(
  has_function_privilege('authenticated', 'public.commit_daily_ritual(uuid, bigint, uuid)', 'execute'),
  'authenticated callers can reach the validated commit transaction'
);

set local role anon;
select throws_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000001', 1, 'e3000000-0000-4000-8000-000000000001')$$,
  '42501', null::text,
  'anonymous callers cannot invoke the commit transaction'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select throws_ok(
  $$update public.ritual_sessions
      set status = 'committed', committed_at = now(), version = version + 1
    where id = 'd3000000-0000-4000-8000-000000000001'
  returning 1$$,
  '42501', null::text,
  'ordinary authenticated updates cannot move a daily draft across the commit boundary'
);

select lives_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000001', 1, 'e3000000-0000-4000-8000-000000000001')$$,
  'the owner can atomically commit a complete daily draft'
);
select is(
  (select status::text from public.ritual_sessions where id = 'd3000000-0000-4000-8000-000000000001'),
  'committed',
  'successful commit closes the daily session'
);
select ok(
  (select committed_at is not null from public.ritual_sessions where id = 'd3000000-0000-4000-8000-000000000001'),
  'successful commit records its close timestamp'
);
select is(
  (select count(*) from public.commitment_events where ritual_session_id = 'd3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'successful commit appends exactly one stable outcome event'
);
select is(
  (select kind::text from public.commitment_events where ritual_session_id = 'd3000000-0000-4000-8000-000000000001'),
  'done',
  'the outcome event records the reviewed score'
);
select lives_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000001', 1, 'e3000000-0000-4000-8000-000000000002')$$,
  'a repeated close is idempotent'
);
select is(
  (select count(*) from public.commitment_events where ritual_session_id = 'd3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an idempotent replay does not append another outcome event'
);
select results_eq(
  $$update public.ritual_sessions set version = version + 1 where id = 'd3000000-0000-4000-8000-000000000001' returning 1$$,
  $$select 1 where false$$,
  'ordinary authenticated updates still cannot rewrite a committed session'
);
select throws_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000002', 0, 'e3000000-0000-4000-8000-000000000003')$$,
  '40001', null::text,
  'stale draft versions cannot commit'
);
select throws_ok(
  $$select * from public.commit_daily_ritual('d4000000-0000-4000-8000-000000000001', 1, 'e3000000-0000-4000-8000-000000000004')$$,
  '42501', null::text,
  'an authenticated user cannot commit another owner session'
);

select * from finish();

rollback;
