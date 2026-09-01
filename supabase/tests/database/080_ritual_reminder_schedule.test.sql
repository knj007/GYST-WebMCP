begin;

select plan(18);

insert into auth.users (id, email) values
  ('a8000000-0000-4000-8000-000000000001', 'schedule-owner@example.test'),
  ('a8000000-0000-4000-8000-000000000002', 'schedule-other@example.test');
insert into public.profiles (user_id, timezone) values
  ('a8000000-0000-4000-8000-000000000001', 'America/Chicago'),
  ('a8000000-0000-4000-8000-000000000002', 'UTC');

select ok(not (select prosecdef from pg_proc where oid = 'public.save_ritual_reminder_schedule(public.ritual_kind, boolean, time, smallint)'::regprocedure), 'schedule RPC uses invoker authority');
select ok(not has_function_privilege('anon', 'public.save_ritual_reminder_schedule(public.ritual_kind, boolean, time, smallint)', 'execute'), 'anon cannot set a schedule');
select ok(has_function_privilege('authenticated', 'public.save_ritual_reminder_schedule(public.ritual_kind, boolean, time, smallint)', 'execute'), 'authenticated users can set their own schedule');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-4000-8000-000000000001', true);

select lives_ok($$select * from public.save_ritual_reminder_schedule('daily', true, '20:00'::time, null)$$, 'an owner can enable a daily ritual schedule');
select is((select cadence::text from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), 'daily', 'daily schedule uses daily cadence');
select is((select timezone from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), 'America/Chicago', 'daily schedule uses the owner profile timezone');
select ok((select next_run_at > now() from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), 'enabled daily schedule has a future run');
select is((select count(*) from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), 1::bigint, 'one daily settings rule exists');

select lives_ok($$select * from public.save_ritual_reminder_schedule('daily', false, '21:00'::time, null)$$, 'an owner can pause a daily ritual schedule');
select ok(not (select enabled from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), 'paused schedule is disabled');
select ok((select next_run_at is null from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), 'paused schedule has no due run');
select is((select local_time::text from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), '21:00:00', 'paused schedule retains its selected time');

select lives_ok($$select * from public.save_ritual_reminder_schedule('weekly', true, '09:00'::time, 1::smallint)$$, 'an owner can enable a weekly ritual schedule');
select is((select weekday from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'weekly'), 1::smallint, 'weekly schedule retains its ISO weekday');
select ok((select next_run_at > now() from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'weekly'), 'enabled weekly schedule has a future run');
select throws_ok($$select * from public.save_ritual_reminder_schedule('weekly', true, '09:00'::time, 8::smallint)$$, '23514', 'weekly reminders need an ISO weekday from 1 to 7', 'invalid weekly weekday is rejected');

select set_config('request.jwt.claim.sub', 'a8000000-0000-4000-8000-000000000002', true);
select lives_ok($$select * from public.save_ritual_reminder_schedule('daily', true, '08:00'::time, null)$$, 'a second owner can create only their own schedule');
reset role;
select is((select local_time::text from public.reminder_rules where user_id = 'a8000000-0000-4000-8000-000000000001' and is_ritual_schedule and ritual_kind = 'daily'), '21:00:00', 'another owner cannot overwrite the first owner schedule');

select * from finish();
rollback;
