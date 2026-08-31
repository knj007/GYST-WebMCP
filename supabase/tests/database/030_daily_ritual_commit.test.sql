begin;

select plan(37);

insert into auth.users (id, email)
values
  ('33333333-3333-4333-8333-333333333333', 'daily-owner@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'daily-other@example.test');

insert into public.profiles (user_id)
values
  ('33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444');

insert into public.commitments (id, user_id, title, state, completed_at)
values
  ('c3000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'Yesterday action', 'active', null),
  ('c3000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'Tomorrow action', 'active', null),
  ('c3000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'Completed action', 'completed', now());

insert into public.ritual_sessions (id, user_id, kind, period_start)
values
  ('d3000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'daily', '2026-08-30'),
  ('d3000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'daily', '2026-08-31'),
  ('d3000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'daily', '2026-09-01'),
  ('d4000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'daily', '2026-08-30');

insert into public.daily_entries (
  user_id, ritual_session_id, moved_text, blocker_text, blocker_type,
  previous_commitment_id, previous_commitment_outcome, next_commitment_id
)
values
  ('33333333-3333-4333-8333-333333333333', 'd3000000-0000-4000-8000-000000000001', 'Closed the proposal', 'Awaiting review', 'external_gate', 'c3000000-0000-4000-8000-000000000001', 'done', 'c3000000-0000-4000-8000-000000000002'),
  ('33333333-3333-4333-8333-333333333333', 'd3000000-0000-4000-8000-000000000002', 'Draft two', null, null, 'c3000000-0000-4000-8000-000000000001', 'partial', 'c3000000-0000-4000-8000-000000000002'),
  ('33333333-3333-4333-8333-333333333333', 'd3000000-0000-4000-8000-000000000003', 'Draft three', null, null, 'c3000000-0000-4000-8000-000000000001', 'not_done', 'c3000000-0000-4000-8000-000000000003');

select ok(
  not (select prosecdef from pg_proc where oid = 'public.commit_daily_ritual(uuid, bigint)'::regprocedure),
  'daily commit RPC uses invoker authority and keeps RLS in force'
);
select ok(
  not has_function_privilege('anon', 'public.commit_daily_ritual(uuid, bigint)', 'execute'),
  'anonymous callers cannot execute the commit RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.commit_daily_ritual(uuid, bigint)', 'execute'),
  'authenticated callers can reach the optimistic commit RPC'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.save_daily_ritual_draft(date, jsonb, bigint)'::regprocedure),
  'daily draft save RPC uses invoker authority and keeps RLS in force'
);
select ok(
  not has_function_privilege('anon', 'public.save_daily_ritual_draft(date, jsonb, bigint)', 'execute'),
  'anonymous callers cannot execute the draft save RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.save_daily_ritual_draft(date, jsonb, bigint)', 'execute'),
  'authenticated callers can reach the draft save RPC'
);

set local role anon;
select throws_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000001', 1)$$,
  '42501', null::text,
  'anonymous callers cannot invoke the commit RPC'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select lives_ok(
  $$insert into public.commitment_events (
      user_id, commitment_id, kind, outcome, title_snapshot, event_on
    ) values (
      '33333333-3333-4333-8333-333333333333',
      'c3000000-0000-4000-8000-000000000001',
      'done', 'done', 'Yesterday action', '2026-08-30'
    )$$,
  'an authenticated owner may append an owned event outside WebMCP'
);

select lives_ok(
  $$update public.ritual_sessions
      set status = 'committed', version = version + 1
    where id = 'd3000000-0000-4000-8000-000000000001'$$,
  'a complete owner daily close is validated and completed at the ledger boundary'
);
select is(
  (select status::text from public.ritual_sessions where id = 'd3000000-0000-4000-8000-000000000001'),
  'committed',
  'the validated close commits the daily session'
);
select ok(
  (select committed_at is not null from public.ritual_sessions where id = 'd3000000-0000-4000-8000-000000000001'),
  'the ledger boundary supplies the close timestamp'
);
select is(
  (select count(*) from public.commitment_events where ritual_session_id = 'd3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'a validated close appends exactly one stable outcome event'
);
select is(
  (select kind::text from public.commitment_events where ritual_session_id = 'd3000000-0000-4000-8000-000000000001'),
  'done',
  'the stable outcome event records the reviewed score'
);
select is(
  (select event.idempotency_key from public.commitment_events as event where event.ritual_session_id = 'd3000000-0000-4000-8000-000000000001'),
  (select session.idempotency_key from public.ritual_sessions as session where session.id = 'd3000000-0000-4000-8000-000000000001'),
  'the event uses the session-stable idempotency key'
);

select throws_ok(
  $$update public.ritual_sessions
      set status = 'committed', version = version + 1
    where id = 'd3000000-0000-4000-8000-000000000003'$$,
  '23514', null::text,
  'a daily close rejects an inactive next commitment'
);
select is(
  (select status::text from public.ritual_sessions where id = 'd3000000-0000-4000-8000-000000000003'),
  'draft',
  'a rejected close leaves the session as a draft'
);
select is(
  (select count(*) from public.commitment_events where ritual_session_id = 'd3000000-0000-4000-8000-000000000003'),
  0::bigint,
  'a rejected close rolls back its outcome event'
);

select throws_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000002', null::bigint)$$,
  '40001', null::text,
  'a missing draft version cannot commit through the ordinary application RPC'
);
select throws_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000002', 0)$$,
  '40001', null::text,
  'stale draft versions cannot commit through the ordinary application RPC'
);
select lives_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000002', 1)$$,
  'the owner can atomically commit a complete daily draft through the application RPC'
);
select is(
  (select status::text from public.ritual_sessions where id = 'd3000000-0000-4000-8000-000000000002'),
  'committed',
  'the RPC closes the daily session'
);
select lives_ok(
  $$select * from public.commit_daily_ritual('d3000000-0000-4000-8000-000000000002', 1)$$,
  'a repeated application close is idempotent'
);
select is(
  (select count(*) from public.commitment_events where ritual_session_id = 'd3000000-0000-4000-8000-000000000002'),
  1::bigint,
  'an idempotent replay does not append another outcome event'
);
select results_eq(
  $$update public.ritual_sessions set version = version + 1 where id = 'd3000000-0000-4000-8000-000000000002' returning 1$$,
  $$select 1 where false$$,
  'ordinary authenticated updates cannot rewrite a committed session'
);
select throws_ok(
  $$select * from public.commit_daily_ritual('d4000000-0000-4000-8000-000000000001', 1)$$,
  '42501', null::text,
  'an authenticated user cannot commit another owner session'
);
select throws_ok(
  $$update public.ritual_sessions
      set idempotency_key = 'f3000000-0000-4000-8000-000000000001'
    where id = 'd3000000-0000-4000-8000-000000000003'$$,
  '23514', null::text,
  'the session idempotency key is immutable'
);
select lives_ok(
  $$select * from public.save_daily_ritual_draft(
      '2026-09-02',
      '{"moved_text":"First atomic draft","blocker_text":null,"blocker_type":null,"previous_commitment_id":null,"previous_commitment_outcome":null,"next_commitment_id":null,"optional_context":null,"buried_win":null,"is_sensitive":false}'::jsonb
    )$$,
  'the first draft save creates its session and entry atomically'
);
select is(
  (select version from public.ritual_sessions where user_id = '33333333-3333-4333-8333-333333333333' and kind = 'daily' and period_start = '2026-09-02'),
  1::bigint,
  'the first atomic draft save establishes version one'
);
select throws_ok(
  $$select * from public.save_daily_ritual_draft(
      '2026-09-02',
      '{"moved_text":"Stale overwrite","blocker_text":null,"blocker_type":null,"previous_commitment_id":null,"previous_commitment_outcome":null,"next_commitment_id":null,"optional_context":null,"buried_win":null,"is_sensitive":false}'::jsonb,
      0
    )$$,
  '40001', null::text,
  'a stale draft version is rejected before either draft row changes'
);
select throws_ok(
  $$select * from public.save_daily_ritual_draft(
      '2026-09-02',
      '{"moved_text":"Missing version overwrite","blocker_text":null,"blocker_type":null,"previous_commitment_id":null,"previous_commitment_outcome":null,"next_commitment_id":null,"optional_context":null,"buried_win":null,"is_sensitive":false}'::jsonb
    )$$,
  '40001', null::text,
  'an existing daily draft requires its expected version'
);
select is(
  (select moved_text from public.daily_entries where user_id = '33333333-3333-4333-8333-333333333333' and ritual_session_id = (select id from public.ritual_sessions where user_id = '33333333-3333-4333-8333-333333333333' and kind = 'daily' and period_start = '2026-09-02')),
  'First atomic draft',
  'a stale draft save leaves the stored entry unchanged'
);
select lives_ok(
  $$select * from public.save_daily_ritual_draft(
      '2026-09-02',
      '{"moved_text":"Corrected atomic draft","blocker_text":null,"blocker_type":null,"previous_commitment_id":null,"previous_commitment_outcome":null,"next_commitment_id":null,"optional_context":null,"buried_win":null,"is_sensitive":true}'::jsonb,
      1
    )$$,
  'the current draft version updates the session and entry together'
);
select is(
  (select version from public.ritual_sessions where user_id = '33333333-3333-4333-8333-333333333333' and kind = 'daily' and period_start = '2026-09-02'),
  2::bigint,
  'a successful subsequent draft save advances the session version'
);
select is(
  (select moved_text from public.daily_entries where user_id = '33333333-3333-4333-8333-333333333333' and ritual_session_id = (select id from public.ritual_sessions where user_id = '33333333-3333-4333-8333-333333333333' and kind = 'daily' and period_start = '2026-09-02')),
  'Corrected atomic draft',
  'a successful subsequent draft save updates the entry with the same transaction'
);
select throws_ok(
  $$select * from public.save_daily_ritual_draft(
      '2026-09-02',
      '{"moved_text":"Should not persist","blocker_text":null,"blocker_type":"capacity","previous_commitment_id":null,"previous_commitment_outcome":null,"next_commitment_id":null,"optional_context":null,"buried_win":null,"is_sensitive":false}'::jsonb,
      2
    )$$,
  '23514', null::text,
  'an invalid paired blocker value rolls the whole draft save back'
);
select is(
  (select moved_text from public.daily_entries where user_id = '33333333-3333-4333-8333-333333333333' and ritual_session_id = (select id from public.ritual_sessions where user_id = '33333333-3333-4333-8333-333333333333' and kind = 'daily' and period_start = '2026-09-02')),
  'Corrected atomic draft',
  'a failed draft save leaves both the entry and versioned session coherent'
);
select throws_ok(
  $$select * from public.save_daily_ritual_draft('2026-09-03', null::jsonb)$$,
  '22023', null::text,
  'a daily draft payload must be a JSON object'
);

select * from finish();

rollback;
