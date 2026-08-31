begin;

select plan(20);

insert into auth.users (id, email) values
  ('55555555-5555-4555-8555-555555555555', 'weekly-owner@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'weekly-other@example.test');
insert into public.profiles (user_id, timezone) values
  ('55555555-5555-4555-8555-555555555555', 'America/Chicago'),
  ('66666666-6666-4666-8666-666666666666', 'UTC');
insert into public.goals (id, user_id, title, priority) values
  ('a5000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'Top fictional goal', 1),
  ('a5000000-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', 'Lower fictional goal', 4);
insert into public.commitments (id, user_id, goal_id, title) values
  ('c5000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'a5000000-0000-4000-8000-000000000001', 'Repeat fictional commitment'),
  ('c5000000-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', 'a5000000-0000-4000-8000-000000000002', 'Outside fictional commitment');
insert into public.ritual_sessions (id, user_id, kind, period_start) values
  ('d5000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'daily', '2026-08-31'),
  ('d5000000-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', 'daily', '2026-09-01'),
  ('d5000000-0000-4000-8000-000000000003', '55555555-5555-4555-8555-555555555555', 'daily', '2026-09-02');
insert into public.daily_entries (user_id, ritual_session_id, moved_text, blocker_text, blocker_type, previous_commitment_id, previous_commitment_outcome, next_commitment_id, buried_win) values
  ('55555555-5555-4555-8555-555555555555', 'd5000000-0000-4000-8000-000000000001', 'First move', 'Waiting on regulator', 'external_gate', 'c5000000-0000-4000-8000-000000000001', 'partial', 'c5000000-0000-4000-8000-000000000001', 'Exact  buried win; punctuation stays.'),
  ('55555555-5555-4555-8555-555555555555', 'd5000000-0000-4000-8000-000000000002', 'Second move', 'Waiting on regulator', 'external_gate', 'c5000000-0000-4000-8000-000000000001', 'deferred', 'c5000000-0000-4000-8000-000000000001', null),
  ('55555555-5555-4555-8555-555555555555', 'd5000000-0000-4000-8000-000000000003', 'Third move', 'Waiting on regulator', 'external_gate', 'c5000000-0000-4000-8000-000000000001', 'not_done', 'c5000000-0000-4000-8000-000000000001', null);
update public.ritual_sessions set status = 'committed', version = version + 1 where id::text like 'd5000000-%';
insert into public.commitment_events (user_id, commitment_id, kind, outcome, title_snapshot, event_on) values
  ('55555555-5555-4555-8555-555555555555', 'c5000000-0000-4000-8000-000000000002', 'done', 'done', 'Outside fictional commitment', '2026-09-03');
insert into public.key_dates (id, user_id, title, due_on) values
  ('e5000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'Fictional review date', '2026-09-18');

select ok(not (select prosecdef from pg_proc where oid = 'public.get_weekly_context(date)'::regprocedure), 'weekly context RPC uses invoker authority');
select ok(not (select prosecdef from pg_proc where oid = 'public.save_weekly_ritual_draft(date, jsonb, bigint)'::regprocedure), 'weekly draft RPC uses invoker authority');
select ok(not (select prosecdef from pg_proc where oid = 'public.commit_weekly_ritual(uuid, bigint)'::regprocedure), 'weekly commit RPC uses invoker authority');
select ok(not has_function_privilege('anon', 'public.get_weekly_context(date)', 'execute'), 'anonymous callers cannot read weekly context');
select ok(has_function_privilege('authenticated', 'public.commit_weekly_ritual(uuid, bigint)', 'execute'), 'authenticated callers can reach the weekly commit RPC');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select throws_ok($$select public.get_weekly_context('2026-09-01')$$, '22023', null::text, 'weekly context rejects a non-Monday bound');
select is((public.get_weekly_context('2026-08-31')->>'week_end'), '2026-09-06', 'weekly context is bounded through Sunday in the owner timezone');
select ok(jsonb_path_exists(public.get_weekly_context('2026-08-31'), '$.findings[*] ? (@.type == "repeated_noncompletion")'), 'partial, deferred, and not-done events produce one repeated commitment finding');
select ok(jsonb_path_exists(public.get_weekly_context('2026-08-31'), '$.findings[*] ? (@.type == "blocker_recurrence" && @.detail.blocker_type == "external_gate" && @.detail.avoidant_stall == false)'), 'three external gates remain a blocker recurrence but never an avoidant-stall finding');
select ok(jsonb_path_exists(public.get_weekly_context('2026-08-31'), '$.findings[*] ? (@.type == "buried_win" && @.detail.text == "Exact  buried win; punctuation stays.")'), 'buried wins preserve their exact stored text');
select ok(jsonb_path_exists(public.get_weekly_context('2026-08-31'), '$.findings[*] ? (@.type == "outside_priorities")'), 'work outside an active top priority is surfaced');
select ok(jsonb_path_exists(public.get_weekly_context('2026-08-31'), '$.findings[*] ? (@.type == "approaching_key_date")'), 'key dates in the next 21 days are surfaced');
select is((select count(*) from jsonb_array_elements(public.get_weekly_context('2026-08-31')->'findings') as finding where finding->>'type' = 'repeated_noncompletion'), 1::bigint, 'planned skips are not counted and a title edit cannot reset event-based staleness');
select lives_ok($$select * from public.save_weekly_ritual_draft('2026-08-31', '{"missing_metrics":["Cycle time"],"observations":["Fictional evidence"],"decision_text":"Protect the review window.","arrow":"up","priorities":[{"title":"Publish fictional summary","due_on":"2026-09-07"}]}'::jsonb)$$, 'owner can save an initial weekly draft');
select throws_ok($$select * from public.save_weekly_ritual_draft('2026-08-31', '{}'::jsonb)$$, '40001', null::text, 'existing weekly drafts require an optimistic version');
select throws_ok($$select * from public.commit_weekly_ritual((select id from public.ritual_sessions where user_id = '55555555-5555-4555-8555-555555555555' and kind = 'weekly'), null::bigint)$$, '40001', null::text, 'a missing weekly commit version is stale');
select lives_ok($$select * from public.commit_weekly_ritual((select id from public.ritual_sessions where user_id = '55555555-5555-4555-8555-555555555555' and kind = 'weekly'), 1)$$, 'owner can commit a complete weekly draft');
select lives_ok($$select * from public.commit_weekly_ritual((select id from public.ritual_sessions where user_id = '55555555-5555-4555-8555-555555555555' and kind = 'weekly'), 1)$$, 'weekly commit replay is idempotent');
select results_eq($$update public.ritual_sessions set version = version + 1 where user_id = '55555555-5555-4555-8555-555555555555' and kind = 'weekly' returning 1$$, $$select 1 where false$$, 'a committed weekly session cannot be rewritten');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select is((public.get_weekly_context('2026-08-31')->'findings'), '[]'::jsonb, 'another owner cannot read this week''s findings');

select * from finish();
rollback;
