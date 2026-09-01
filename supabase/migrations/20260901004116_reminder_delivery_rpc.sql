-- Wave 6: stateless reminder delivery contract.
--
-- The Worker only receives a bounded claimed batch through these service-role
-- RPCs. The notification event remains the durable, idempotent ledger record;
-- Cloudflare holds no delivery state.

-- The service role needs only the recipient address needed by the narrow claim
-- RPC. No browser role receives this Auth-table privilege.
grant usage on schema auth to service_role;
grant select (id, email) on auth.users to service_role;
grant usage on schema gyst_private to service_role;

create function gyst_private.next_reminder_run_at(
  p_scheduled_for timestamptz,
  p_cadence public.reminder_cadence,
  p_local_time time,
  p_timezone text
)
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select case p_cadence
    when 'once'::public.reminder_cadence then null
    when 'daily'::public.reminder_cadence then
      (((p_scheduled_for at time zone p_timezone)::date + 1)::timestamp + p_local_time) at time zone p_timezone
    when 'weekly'::public.reminder_cadence then
      (((p_scheduled_for at time zone p_timezone)::date + 7)::timestamp + p_local_time) at time zone p_timezone
  end;
$$;

revoke all on function gyst_private.next_reminder_run_at(timestamptz, public.reminder_cadence, time, text)
  from public, anon, authenticated;
grant execute on function gyst_private.next_reminder_run_at(timestamptz, public.reminder_cadence, time, text) to service_role;

create function public.claim_due_reminder_notifications(
  p_now timestamptz,
  p_batch_size integer default 25,
  p_claim_timeout_seconds integer default 900
)
returns table (
  notification_event_id uuid,
  reminder_rule_id uuid,
  recipient_email text,
  scheduled_for timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_now is null or p_batch_size not between 1 and 100 or p_claim_timeout_seconds not between 60 and 3600 then
    raise exception 'reminder claim arguments are invalid' using errcode = '22023';
  end if;

  -- Materialize each due occurrence exactly once. A concurrent scheduler can
  -- reach this statement, but the unique rule/schedule constraint is the
  -- authoritative duplicate guard.
  insert into public.notification_events (user_id, reminder_rule_id, scheduled_for)
  select rule.user_id, rule.id, rule.next_run_at
    from public.reminder_rules as rule
   where rule.enabled
     and rule.next_run_at <= p_now
     and not exists (
       select 1
         from public.commitment_events as event
        where event.user_id = rule.user_id
          and event.commitment_id = rule.commitment_id
          and event.outcome = 'planned_skip'::public.commitment_outcome
          and event.event_on = (p_now at time zone rule.timezone)::date
     )
  on conflict on constraint notification_events_rule_schedule_key do nothing;

  -- Recover a Worker invocation that ended after claiming but before recording
  -- its result. The Worker supplies the notification ID as Resend's idempotency
  -- key, so a provider retry remains safe.
  update public.notification_events as event
     set status = 'failed'::public.notification_status,
         failed_at = p_now,
         error_code = 'claim_timeout',
         version = event.version + 1
    from public.reminder_rules as rule
   where event.user_id = rule.user_id
     and event.reminder_rule_id = rule.id
     and event.status = 'claimed'::public.notification_status
     and event.claimed_at < p_now - make_interval(secs => p_claim_timeout_seconds)
     and rule.enabled
     and rule.next_run_at = event.scheduled_for;

  return query
  with candidates as (
    select event.id
      from public.notification_events as event
      join public.reminder_rules as rule
        on rule.user_id = event.user_id
       and rule.id = event.reminder_rule_id
      join auth.users as user_record on user_record.id = event.user_id
     where rule.enabled
       and rule.next_run_at = event.scheduled_for
       and user_record.email is not null
       and event.status in ('pending'::public.notification_status, 'failed'::public.notification_status)
     order by event.scheduled_for, event.id
     for update of event skip locked
     limit p_batch_size
  ), claimed as (
    update public.notification_events as event
       set status = 'claimed'::public.notification_status,
           attempt_count = event.attempt_count + 1,
           claimed_at = p_now,
           failed_at = null,
           error_code = null,
           version = event.version + 1
      from candidates
     where event.id = candidates.id
    returning event.id, event.reminder_rule_id, event.user_id, event.scheduled_for
  )
  select claimed.id, claimed.reminder_rule_id, user_record.email::text, claimed.scheduled_for
    from claimed
    join auth.users as user_record on user_record.id = claimed.user_id
   where user_record.email is not null;
end;
$$;

create function public.reminder_claim_is_active(p_notification_event_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
      from public.notification_events as event
      join public.reminder_rules as rule
        on rule.user_id = event.user_id
       and rule.id = event.reminder_rule_id
     where event.id = p_notification_event_id
       and event.status = 'claimed'::public.notification_status
       and rule.enabled
       and rule.next_run_at = event.scheduled_for
  );
$$;

create function public.record_reminder_delivery(
  p_notification_event_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule public.reminder_rules%rowtype;
  v_event public.notification_events%rowtype;
  v_next_run_at timestamptz;
begin
  if p_notification_event_id is null or p_provider_message_id is null or char_length(p_provider_message_id) not between 1 and 500 then
    raise exception 'reminder delivery arguments are invalid' using errcode = '22023';
  end if;

  select event.* into v_event
    from public.notification_events as event
   where event.id = p_notification_event_id
   for update;
  if not found then
    raise exception 'notification event was not found' using errcode = '22023';
  end if;
  if v_event.status = 'sent'::public.notification_status then
    return true;
  end if;
  if v_event.status <> 'claimed'::public.notification_status then
    return false;
  end if;

  select rule.* into v_rule
    from public.reminder_rules as rule
   where rule.user_id = v_event.user_id and rule.id = v_event.reminder_rule_id
   for update;
  if not found or not v_rule.enabled or v_rule.next_run_at <> v_event.scheduled_for then
    update public.notification_events
       set status = 'cancelled'::public.notification_status,
           version = version + 1
     where id = v_event.id;
    return false;
  end if;

  v_next_run_at := gyst_private.next_reminder_run_at(
    v_event.scheduled_for, v_rule.cadence, v_rule.local_time, v_rule.timezone
  );

  update public.notification_events
     set status = 'sent'::public.notification_status,
         sent_at = now(),
         provider_message_id = p_provider_message_id,
         version = version + 1
   where id = v_event.id;

  update public.reminder_rules
     set next_run_at = v_next_run_at,
         enabled = case when v_rule.cadence = 'once'::public.reminder_cadence then false else enabled end,
         version = version + 1
   where user_id = v_rule.user_id
     and id = v_rule.id
     and next_run_at = v_event.scheduled_for;

  return true;
end;
$$;

create function public.record_reminder_failure(
  p_notification_event_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_notification_event_id is null or p_error_code is null or char_length(p_error_code) not between 1 and 500 then
    raise exception 'reminder failure arguments are invalid' using errcode = '22023';
  end if;

  update public.notification_events
     set status = 'failed'::public.notification_status,
         failed_at = now(),
         error_code = p_error_code,
         version = version + 1
   where id = p_notification_event_id
     and status = 'claimed'::public.notification_status;

  return found;
end;
$$;

revoke all on function public.claim_due_reminder_notifications(timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.reminder_claim_is_active(uuid) from public, anon, authenticated;
revoke all on function public.record_reminder_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.record_reminder_failure(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_due_reminder_notifications(timestamptz, integer, integer) to service_role;
grant execute on function public.reminder_claim_is_active(uuid) to service_role;
grant execute on function public.record_reminder_delivery(uuid, text) to service_role;
grant execute on function public.record_reminder_failure(uuid, text) to service_role;
