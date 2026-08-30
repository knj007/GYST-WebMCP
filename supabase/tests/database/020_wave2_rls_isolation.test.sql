begin;

select plan(95);

-- Fixed fictional identities make failures reproducible without creating real users.
insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'owner-b@example.test');

insert into public.profiles (id, user_id, display_name)
values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Owner A'),
  ('b0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Owner B');

insert into public.areas (id, user_id, title)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Area A'),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Area B');

insert into public.goals (id, user_id, area_id, title)
values
  ('a2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'Goal A'),
  ('b2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'Goal B');

insert into public.key_dates (id, user_id, goal_id, title, due_on)
values
  ('a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a2000000-0000-4000-8000-000000000001', 'Date A', '2026-09-10'),
  ('b3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b2000000-0000-4000-8000-000000000001', 'Date B', '2026-09-11');

insert into public.commitments (id, user_id, goal_id, title)
values
  ('a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a2000000-0000-4000-8000-000000000001', 'Commitment A'),
  ('b4000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b2000000-0000-4000-8000-000000000001', 'Commitment B');

insert into public.ritual_sessions (id, user_id, kind, period_start)
values
  ('a5000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'daily', '2026-08-28'),
  ('b5000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'daily', '2026-08-28'),
  ('a5000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'weekly', '2026-08-24'),
  ('b5000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'weekly', '2026-08-24'),
  ('a5000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'daily', '2026-08-29');

insert into public.daily_entries (
  id, user_id, ritual_session_id, moved_text, previous_commitment_id, previous_commitment_outcome
)
values
  ('a6000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a5000000-0000-4000-8000-000000000001', 'Moved A', 'a4000000-0000-4000-8000-000000000001', 'done'),
  ('b6000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b5000000-0000-4000-8000-000000000001', 'Moved B', 'b4000000-0000-4000-8000-000000000001', 'partial');

insert into public.weekly_entries (id, user_id, ritual_session_id, decision_text)
values
  ('a7000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a5000000-0000-4000-8000-000000000002', 'Decision A'),
  ('b7000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b5000000-0000-4000-8000-000000000002', 'Decision B');

insert into public.commitment_events (
  id, user_id, commitment_id, ritual_session_id, kind, outcome, title_snapshot, event_on
)
values
  ('a8000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'done', 'done', 'Commitment A', '2026-08-28'),
  ('b8000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b4000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'partial', 'partial', 'Commitment B', '2026-08-28');

insert into public.reminder_rules (
  id, user_id, ritual_kind, cadence, local_time, weekday, timezone, next_run_at
)
values
  ('a9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'weekly', 'weekly', '09:00', 1, 'UTC', '2026-08-31 09:00+00'),
  ('b9000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'weekly', 'weekly', '09:00', 1, 'UTC', '2026-08-31 09:00+00');

insert into public.notification_events (
  id, user_id, reminder_rule_id, scheduled_for
)
values
  ('aa000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a9000000-0000-4000-8000-000000000001', '2026-08-31 09:00+00'),
  ('bb000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b9000000-0000-4000-8000-000000000001', '2026-08-31 09:00+00');

update public.ritual_sessions
set status = 'committed', committed_at = now(), version = version + 1
where id in (
  'a5000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000002',
  'b5000000-0000-4000-8000-000000000002'
);

-- Anonymous has neither grants nor policies for any application table.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok($$select 1 from public.profiles limit 1$$, '42501', null::text, 'anonymous cannot read profiles');
select throws_ok($$select 1 from public.areas limit 1$$, '42501', null::text, 'anonymous cannot read areas');
select throws_ok($$select 1 from public.goals limit 1$$, '42501', null::text, 'anonymous cannot read goals');
select throws_ok($$select 1 from public.key_dates limit 1$$, '42501', null::text, 'anonymous cannot read key dates');
select throws_ok($$select 1 from public.commitments limit 1$$, '42501', null::text, 'anonymous cannot read commitments');
select throws_ok($$select 1 from public.ritual_sessions limit 1$$, '42501', null::text, 'anonymous cannot read ritual sessions');
select throws_ok($$select 1 from public.daily_entries limit 1$$, '42501', null::text, 'anonymous cannot read daily entries');
select throws_ok($$select 1 from public.weekly_entries limit 1$$, '42501', null::text, 'anonymous cannot read weekly entries');
select throws_ok($$select 1 from public.commitment_events limit 1$$, '42501', null::text, 'anonymous cannot read commitment events');
select throws_ok($$select 1 from public.reminder_rules limit 1$$, '42501', null::text, 'anonymous cannot read reminder rules');
select throws_ok($$select 1 from public.notification_events limit 1$$, '42501', null::text, 'anonymous cannot read notification events');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

-- Owner A sees only Owner A rows, including two committed ritual sessions.
select is((select count(*) from public.profiles), 1::bigint, 'owner sees only own profile');
select is((select count(*) from public.areas), 1::bigint, 'owner sees only own areas');
select is((select count(*) from public.goals), 1::bigint, 'owner sees only own goals');
select is((select count(*) from public.key_dates), 1::bigint, 'owner sees only own key dates');
select is((select count(*) from public.commitments), 1::bigint, 'owner sees only own commitments');
select is((select count(*) from public.ritual_sessions), 3::bigint, 'owner sees only own ritual sessions');
select is((select count(*) from public.daily_entries), 1::bigint, 'owner sees only own daily entries');
select is((select count(*) from public.weekly_entries), 1::bigint, 'owner sees only own weekly entries');
select is((select count(*) from public.commitment_events), 1::bigint, 'owner sees only own commitment events');
select is((select count(*) from public.reminder_rules), 1::bigint, 'owner sees only own reminder rules');
select is((select count(*) from public.notification_events), 1::bigint, 'owner sees only own notification events');

-- Cross-user UPDATE and DELETE attempts affect no rows.
select results_eq($$update public.areas set title = 'hijacked' where id = 'b1000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user area');
select results_eq($$delete from public.areas where id = 'b1000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user area');
select results_eq($$update public.goals set title = 'hijacked' where id = 'b2000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user goal');
select results_eq($$delete from public.goals where id = 'b2000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user goal');
select results_eq($$update public.key_dates set title = 'hijacked' where id = 'b3000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user key date');
select results_eq($$delete from public.key_dates where id = 'b3000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user key date');
select results_eq($$update public.commitments set title = 'hijacked' where id = 'b4000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user commitment');
select results_eq($$delete from public.commitments where id = 'b4000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user commitment');
select results_eq($$update public.ritual_sessions set version = version + 1 where id = 'b5000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user ritual session');
select results_eq($$delete from public.ritual_sessions where id = 'b5000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user ritual session');
select results_eq($$update public.daily_entries set moved_text = 'hijacked' where id = 'b6000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user daily entry');
select results_eq($$delete from public.daily_entries where id = 'b6000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user daily entry');
select results_eq($$update public.weekly_entries set decision_text = 'hijacked' where id = 'b7000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user weekly entry');
select results_eq($$delete from public.weekly_entries where id = 'b7000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user weekly entry');
select results_eq($$update public.reminder_rules set enabled = false where id = 'b9000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update another user reminder');
select results_eq($$delete from public.reminder_rules where id = 'b9000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete another user reminder');

select throws_ok($$update public.commitment_events set title_snapshot = 'changed' where id = 'a8000000-0000-4000-8000-000000000001'$$, '42501', null::text, 'authenticated users cannot rewrite commitment events');
select throws_ok($$delete from public.commitment_events where id = 'a8000000-0000-4000-8000-000000000001'$$, '42501', null::text, 'authenticated users cannot delete commitment events');
select throws_ok($$insert into public.notification_events (user_id, reminder_rule_id, scheduled_for) values ('11111111-1111-4111-8111-111111111111', 'a9000000-0000-4000-8000-000000000001', '2026-09-01 09:00+00')$$, '42501', null::text, 'authenticated users cannot manufacture notification history');
select throws_ok($$update public.notification_events set status = 'cancelled' where id = 'aa000000-0000-4000-8000-000000000001'$$, '42501', null::text, 'authenticated users cannot update notification history');
select throws_ok($$delete from public.notification_events where id = 'aa000000-0000-4000-8000-000000000001'$$, '42501', null::text, 'authenticated users cannot delete notification history');

-- Ownership checks and composite foreign keys reject cross-owner writes.
select throws_ok($$insert into public.areas (user_id, title) values ('22222222-2222-4222-8222-222222222222', 'Wrong owner')$$, '42501', null::text, 'owner cannot insert a row for another user');
select throws_ok($$insert into public.goals (user_id, area_id, title) values ('11111111-1111-4111-8111-111111111111', 'b1000000-0000-4000-8000-000000000001', 'Cross-owner goal')$$, '23503', null::text, 'goal cannot link to another user area');
select throws_ok($$insert into public.key_dates (user_id, goal_id, title, due_on) values ('11111111-1111-4111-8111-111111111111', 'b2000000-0000-4000-8000-000000000001', 'Cross-owner date', '2026-09-12')$$, '23503', null::text, 'key date cannot link to another user goal');
select throws_ok($$insert into public.commitments (user_id, goal_id, title) values ('11111111-1111-4111-8111-111111111111', 'b2000000-0000-4000-8000-000000000001', 'Cross-owner commitment')$$, '23503', null::text, 'commitment cannot link to another user goal');
select throws_ok($$insert into public.daily_entries (user_id, ritual_session_id) values ('11111111-1111-4111-8111-111111111111', 'b5000000-0000-4000-8000-000000000001')$$, '42501', null::text, 'daily entry cannot link to another user session');
select throws_ok($$insert into public.daily_entries (user_id, ritual_session_id, previous_commitment_id, previous_commitment_outcome) values ('11111111-1111-4111-8111-111111111111', 'a5000000-0000-4000-8000-000000000003', 'b4000000-0000-4000-8000-000000000001', 'partial')$$, '23503', null::text, 'daily entry cannot link to another user commitment');
select throws_ok($$insert into public.weekly_entries (user_id, ritual_session_id) values ('11111111-1111-4111-8111-111111111111', 'b5000000-0000-4000-8000-000000000002')$$, '42501', null::text, 'weekly entry cannot link to another user session');
select throws_ok($$insert into public.commitment_events (user_id, commitment_id, kind, title_snapshot, event_on) values ('11111111-1111-4111-8111-111111111111', 'b4000000-0000-4000-8000-000000000001', 'created', 'Cross-owner event', '2026-08-30')$$, '23503', null::text, 'commitment event cannot link to another user commitment');
select throws_ok($$insert into public.reminder_rules (user_id, ritual_session_id, ritual_kind, cadence, local_time, timezone, next_run_at) values ('11111111-1111-4111-8111-111111111111', 'a5000000-0000-4000-8000-000000000001', 'weekly', 'daily', '09:00', 'UTC', '2026-09-01 09:00+00')$$, '23503', null::text, 'ritual reminder kind must match its session kind');
select throws_ok($$insert into public.reminder_rules (user_id, ritual_session_id, ritual_kind, cadence, local_time, timezone, next_run_at) values ('11111111-1111-4111-8111-111111111111', 'b5000000-0000-4000-8000-000000000001', 'daily', 'daily', '09:00', 'UTC', '2026-09-01 09:00+00')$$, '23503', null::text, 'reminder cannot link to another user session');
select throws_ok($$insert into public.ritual_sessions (user_id, kind, period_start, status, committed_at) values ('11111111-1111-4111-8111-111111111111', 'daily', '2026-08-30', 'committed', now())$$, '42501', null::text, 'authenticated client cannot insert an already committed session');

-- Owner CRUD succeeds where the table is intentionally mutable.
select lives_ok($$update public.profiles set display_name = 'Owner A updated', version = version + 1 where user_id = '11111111-1111-4111-8111-111111111111'$$, 'owner can update own profile');
select lives_ok($$insert into public.areas (id, user_id, title) values ('a1000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'Scratch area')$$, 'owner can insert own area');
select lives_ok($$update public.areas set title = 'Scratch area updated', version = version + 1 where id = 'a1000000-0000-4000-8000-000000000099'$$, 'owner can update own area');
select lives_ok($$delete from public.areas where id = 'a1000000-0000-4000-8000-000000000099'$$, 'owner can delete own unreferenced area');
select lives_ok($$insert into public.goals (id, user_id, title) values ('a2000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'Scratch goal')$$, 'owner can insert own goal');
select lives_ok($$update public.goals set title = 'Scratch goal updated', version = version + 1 where id = 'a2000000-0000-4000-8000-000000000099'$$, 'owner can update own goal');
select lives_ok($$delete from public.goals where id = 'a2000000-0000-4000-8000-000000000099'$$, 'owner can delete own unreferenced goal');
select lives_ok($$insert into public.key_dates (id, user_id, title, due_on) values ('a3000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'Scratch date', '2026-09-20')$$, 'owner can insert own key date');
select lives_ok($$update public.key_dates set title = 'Scratch date updated', version = version + 1 where id = 'a3000000-0000-4000-8000-000000000099'$$, 'owner can update own key date');
select lives_ok($$delete from public.key_dates where id = 'a3000000-0000-4000-8000-000000000099'$$, 'owner can delete own key date');
select lives_ok($$insert into public.commitments (id, user_id, title) values ('a4000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'Scratch commitment')$$, 'owner can insert own commitment');
select lives_ok($$update public.commitments set title = 'Scratch commitment updated', version = version + 1 where id = 'a4000000-0000-4000-8000-000000000099'$$, 'owner can update own commitment');
select lives_ok($$delete from public.commitments where id = 'a4000000-0000-4000-8000-000000000099'$$, 'owner can delete own unreferenced commitment');

select lives_ok($$insert into public.ritual_sessions (id, user_id, kind, period_start) values ('a5000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'daily', '2026-08-31')$$, 'owner can insert own daily draft session');
select lives_ok($$update public.ritual_sessions set version = version + 1 where id = 'a5000000-0000-4000-8000-000000000099'$$, 'owner can update own daily draft session');
select lives_ok($$insert into public.daily_entries (id, user_id, ritual_session_id, moved_text) values ('a6000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'a5000000-0000-4000-8000-000000000099', 'Scratch moved')$$, 'owner can insert own daily draft');
select lives_ok($$update public.daily_entries set moved_text = 'Scratch moved updated', version = version + 1 where id = 'a6000000-0000-4000-8000-000000000099'$$, 'owner can update own daily draft');
select lives_ok($$delete from public.daily_entries where id = 'a6000000-0000-4000-8000-000000000099'$$, 'owner can delete own daily draft');
select lives_ok($$delete from public.ritual_sessions where id = 'a5000000-0000-4000-8000-000000000099'$$, 'owner can delete own daily draft session');

select lives_ok($$insert into public.ritual_sessions (id, user_id, kind, period_start) values ('a5000000-0000-4000-8000-000000000098', '11111111-1111-4111-8111-111111111111', 'weekly', '2026-08-31')$$, 'owner can insert own weekly draft session');
select lives_ok($$update public.ritual_sessions set version = version + 1 where id = 'a5000000-0000-4000-8000-000000000098'$$, 'owner can update own weekly draft session');
select lives_ok($$insert into public.weekly_entries (id, user_id, ritual_session_id, decision_text) values ('a7000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'a5000000-0000-4000-8000-000000000098', 'Scratch decision')$$, 'owner can insert own weekly draft');
select lives_ok($$update public.weekly_entries set decision_text = 'Scratch decision updated', version = version + 1 where id = 'a7000000-0000-4000-8000-000000000099'$$, 'owner can update own weekly draft');
select lives_ok($$delete from public.weekly_entries where id = 'a7000000-0000-4000-8000-000000000099'$$, 'owner can delete own weekly draft');
select lives_ok($$delete from public.ritual_sessions where id = 'a5000000-0000-4000-8000-000000000098'$$, 'owner can delete own weekly draft session');

select lives_ok($$insert into public.commitment_events (id, user_id, commitment_id, ritual_session_id, kind, title_snapshot, event_on) values ('a8000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000003', 'created', 'Commitment A', '2026-08-29')$$, 'owner can append an event to an own draft session');
select is((select count(*) from public.commitment_events), 2::bigint, 'owner can read own appended event');
select lives_ok($$insert into public.reminder_rules (id, user_id, ritual_kind, cadence, local_time, timezone, next_run_at) values ('a9000000-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'daily', 'daily', '08:00', 'UTC', '2026-09-01 08:00+00')$$, 'owner can insert own reminder rule');
select lives_ok($$update public.reminder_rules set local_time = '08:30', version = version + 1 where id = 'a9000000-0000-4000-8000-000000000099'$$, 'owner can update own reminder rule');
select lives_ok($$delete from public.reminder_rules where id = 'a9000000-0000-4000-8000-000000000099'$$, 'owner can delete own reminder rule');
select throws_ok($$delete from public.reminder_rules where id = 'a9000000-0000-4000-8000-000000000001'$$, '23503', null::text, 'delivery history prevents deletion of its reminder rule');

-- Once committed, sessions and their draft payloads cannot be rewritten or deleted.
select results_eq($$update public.ritual_sessions set version = version + 1 where id = 'a5000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update own committed session');
select results_eq($$delete from public.ritual_sessions where id = 'a5000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete own committed session');
select results_eq($$update public.daily_entries set moved_text = 'rewritten' where id = 'a6000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update an entry from a committed daily session');
select results_eq($$delete from public.daily_entries where id = 'a6000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete an entry from a committed daily session');
select results_eq($$update public.weekly_entries set decision_text = 'rewritten' where id = 'a7000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot update an entry from a committed weekly session');
select results_eq($$delete from public.weekly_entries where id = 'a7000000-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'owner cannot delete an entry from a committed weekly session');

reset role;
select throws_ok($$update public.ritual_sessions set version = version + 1 where id = 'a5000000-0000-4000-8000-000000000001'$$, '23514', null::text, 'trigger defense rejects privileged rewrites of committed sessions');
select throws_ok($$update public.daily_entries set ritual_session_id = 'a5000000-0000-4000-8000-000000000003' where id = 'a6000000-0000-4000-8000-000000000001'$$, '23514', null::text, 'trigger defense rejects privileged reparenting away from a committed session');
select throws_ok($$update public.commitment_events set title_snapshot = 'rewritten' where id = 'a8000000-0000-4000-8000-000000000001'$$, '23514', null::text, 'trigger defense rejects privileged rewrites of append-only events');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok($$update public.areas set id = 'a1000000-0000-4000-8000-000000000002' where id = 'a1000000-0000-4000-8000-000000000001'$$, '23514', null::text, 'stable identifiers cannot be changed');

select * from finish();

rollback;
