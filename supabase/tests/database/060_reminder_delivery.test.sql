begin;

select plan(23);

insert into auth.users (id, email) values
  ('77777777-7777-4777-8777-777777777777', 'reminder-owner@example.test'),
  ('88888888-8888-4888-8888-888888888888', 'reminder-other@example.test');
insert into public.profiles (user_id, timezone) values
  ('77777777-7777-4777-8777-777777777777', 'America/Chicago'),
  ('88888888-8888-4888-8888-888888888888', 'UTC');
insert into public.commitments (id, user_id, title) values
  ('c7000000-0000-4000-8000-000000000001', '77777777-7777-4777-8777-777777777777', 'Fictional planned skip commitment');
insert into public.commitment_events (user_id, commitment_id, kind, outcome, title_snapshot, event_on) values
  ('77777777-7777-4777-8777-777777777777', 'c7000000-0000-4000-8000-000000000001', 'planned_skip', 'planned_skip', 'Fictional planned skip commitment', '2026-03-08');
insert into public.reminder_rules (id, user_id, ritual_kind, cadence, local_time, timezone, next_run_at, enabled) values
  ('b7000000-0000-4000-8000-000000000001', '77777777-7777-4777-8777-777777777777', 'daily', 'daily', '09:00', 'America/Chicago', '2026-03-08 14:00+00', true),
  ('b7000000-0000-4000-8000-000000000002', '77777777-7777-4777-8777-777777777777', 'weekly', 'once', '09:00', 'America/Chicago', '2026-03-08 14:00+00', true),
  ('b7000000-0000-4000-8000-000000000003', '77777777-7777-4777-8777-777777777777', 'daily', 'daily', '09:00', 'America/Chicago', '2026-03-08 14:00+00', false);
insert into public.reminder_rules (id, user_id, commitment_id, cadence, local_time, timezone, next_run_at, enabled) values
  ('b7000000-0000-4000-8000-000000000004', '77777777-7777-4777-8777-777777777777', 'c7000000-0000-4000-8000-000000000001', 'daily', '09:00', 'America/Chicago', '2026-03-08 14:00+00', true);

select ok(not (select prosecdef from pg_proc where oid = 'public.claim_due_reminder_notifications(timestamptz, integer, integer)'::regprocedure), 'claim RPC uses invoker authority');
select ok(not has_function_privilege('anon', 'public.claim_due_reminder_notifications(timestamptz, integer, integer)', 'execute'), 'anon cannot claim reminders');
select ok(not has_function_privilege('authenticated', 'public.claim_due_reminder_notifications(timestamptz, integer, integer)', 'execute'), 'authenticated users cannot claim reminders');
select ok(has_function_privilege('service_role', 'public.claim_due_reminder_notifications(timestamptz, integer, integer)', 'execute'), 'only service role can claim reminders');

set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
select throws_ok($$select * from public.claim_due_reminder_notifications('2026-03-08 14:15+00', 25, 900)$$, '42501', null::text, 'an authenticated owner cannot use the delivery RPC');
reset role;

set local role service_role;
select is((select count(*) from public.claim_due_reminder_notifications('2026-03-08 14:15+00', 25, 900)), 2::bigint, 'the due, enabled, non-skipped batch claims exactly two events');
select is((select count(*) from public.claim_due_reminder_notifications('2026-03-08 14:15+00', 25, 900)), 0::bigint, 'overlapping scheduler invocation cannot claim an event twice');
select is((select count(*) from public.notification_events), 2::bigint, 'unique event rows are the duplicate guard');
select is((select count(*) from public.notification_events where reminder_rule_id in ('b7000000-0000-4000-8000-000000000003', 'b7000000-0000-4000-8000-000000000004')), 0::bigint, 'opted-out and planned-skip rules create no notification event');
select ok(public.reminder_claim_is_active((select id from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000001')), 'claimed delivery is active before sending');
select lives_ok($$select public.record_reminder_delivery((select id from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000001'), 'provider-message-daily')$$, 'a claimed daily event reconciles after a provider success');
select is((select status::text from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000001'), 'sent', 'success is recorded on the notification event');
select is((select next_run_at at time zone 'America/Chicago' from public.reminder_rules where id = 'b7000000-0000-4000-8000-000000000001'), '2026-03-09 09:00:00'::timestamp, 'daily recurrence preserves local wall time through DST');
select lives_ok($$select public.record_reminder_delivery((select id from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000002'), 'provider-message-once')$$, 'a claimed one-time event reconciles after success');
select ok(not (select enabled from public.reminder_rules where id = 'b7000000-0000-4000-8000-000000000002'), 'a sent one-time reminder disables itself');
select ok((select next_run_at is null from public.reminder_rules where id = 'b7000000-0000-4000-8000-000000000002'), 'a sent one-time reminder has no future due time');

insert into public.reminder_rules (id, user_id, ritual_kind, cadence, local_time, timezone, next_run_at, enabled) values
  ('b7000000-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', 'daily', 'daily', '10:00', 'UTC', '2026-03-08 14:00+00', true);
select is((select count(*) from public.claim_due_reminder_notifications('2026-03-08 14:15+00', 25, 900)), 1::bigint, 'a newly due reminder is claimed in a bounded later batch');
select ok(public.record_reminder_failure((select id from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000005'), 'resend_503'), 'a provider failure is recorded as retriable');
select is((select status::text from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000005'), 'failed', 'failed deliveries remain in the ledger');
select is((select count(*) from public.claim_due_reminder_notifications('2026-03-08 14:30+00', 25, 900)), 1::bigint, 'a failed delivery can be claimed for a safe retry');
select is((select attempt_count from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000005'), 2, 'retry claim increments the durable attempt count');
select lives_ok($$select public.record_reminder_delivery((select id from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000005'), 'provider-message-retry')$$, 'a retried delivery reconciles successfully');
select is((select status::text from public.notification_events where reminder_rule_id = 'b7000000-0000-4000-8000-000000000005'), 'sent', 'retried delivery ends in sent state');

select * from finish();
rollback;
