begin;

select plan(12);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'owner-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'demo-c@example.test');

insert into public.profiles (user_id, display_name)
values
  ('11111111-1111-4111-8111-111111111111', 'Owner A'),
  ('22222222-2222-4222-8222-222222222222', 'Owner B'),
  ('33333333-3333-4333-8333-333333333333', 'Demo C');

insert into public.ritual_sessions (id, user_id, kind, period_start)
values
  ('a5000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'daily', '2026-09-01'),
  ('b5000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'daily', '2026-09-01'),
  ('c5000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'daily', '2026-09-01');

insert into public.daily_entries (user_id, ritual_session_id, moved_text)
values
  ('11111111-1111-4111-8111-111111111111', 'a5000000-0000-4000-8000-000000000001', 'Owner A record'),
  ('22222222-2222-4222-8222-222222222222', 'b5000000-0000-4000-8000-000000000001', 'Owner B record'),
  ('33333333-3333-4333-8333-333333333333', 'c5000000-0000-4000-8000-000000000001', 'Demo C record');

select ok(has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'), 'authenticated permanent accounts can invoke the narrow deletion RPC');
select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'anonymous visitors cannot invoke account deletion');
select ok(not has_function_privilege('public', 'public.delete_my_account()', 'execute'), 'account deletion RPC has no public execute grant');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}', true);
select lives_ok($$select public.delete_my_account()$$, 'owner B can delete only the identity named by the current JWT');
reset role;
select is((select count(*) from auth.users where id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'owner B Auth identity is deleted');
select is((select count(*) from public.ritual_sessions where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'owner B ritual record cascades');
select is((select count(*) from public.ritual_sessions where user_id = '11111111-1111-4111-8111-111111111111'), 1::bigint, 'owner B cannot delete owner A records');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","is_anonymous":true}', true);
select throws_ok($$select public.delete_my_account()$$, '42501', 'demo accounts cannot be deleted through this flow', 'anonymous demo identity is rejected');
reset role;
select is((select count(*) from auth.users where id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'demo Auth identity remains intact');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}', true);
select lives_ok($$select public.delete_my_account()$$, 'owner A deletion reaches the existing guarded Auth cascade');
reset role;
select is((select count(*) from public.daily_entries where user_id = '11111111-1111-4111-8111-111111111111'), 0::bigint, 'owner A child ledger row cascades precisely');
select is((select count(*) from public.profiles where user_id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'owner A deletion does not affect another remaining owner');

select * from finish();
rollback;
