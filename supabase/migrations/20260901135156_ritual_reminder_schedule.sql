-- One owner-managed reminder per ritual type. Existing ritual_kind rules can
-- represent historical/session-bound reminders, so mark this narrow settings
-- surface explicitly instead of changing their meaning.
alter table public.reminder_rules
  add column is_ritual_schedule boolean not null default false;

create unique index reminder_rules_one_ritual_schedule_per_user_idx
  on public.reminder_rules (user_id, ritual_kind)
  where is_ritual_schedule;

create or replace function public.save_ritual_reminder_schedule(
  p_ritual_kind public.ritual_kind,
  p_enabled boolean,
  p_local_time time,
  p_weekday smallint default null
)
returns table (
  ritual_kind public.ritual_kind,
  cadence public.reminder_cadence,
  local_time time,
  weekday smallint,
  timezone text,
  enabled boolean,
  next_run_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_cadence public.reminder_cadence;
  v_now timestamptz := now();
  v_candidate timestamptz;
  v_days_until integer;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select profiles.timezone into v_timezone
  from public.profiles
  where profiles.user_id = v_user_id;

  if v_timezone is null then
    raise exception 'a profile timezone is required' using errcode = '23514';
  end if;

  v_cadence := case p_ritual_kind
    when 'daily'::public.ritual_kind then 'daily'::public.reminder_cadence
    when 'weekly'::public.ritual_kind then 'weekly'::public.reminder_cadence
  end;

  if p_ritual_kind = 'daily'::public.ritual_kind and p_weekday is not null then
    raise exception 'daily reminders cannot have a weekday' using errcode = '23514';
  end if;
  if p_ritual_kind = 'weekly'::public.ritual_kind and p_weekday not between 1 and 7 then
    raise exception 'weekly reminders need an ISO weekday from 1 to 7' using errcode = '23514';
  end if;

  if p_enabled then
    if p_ritual_kind = 'daily'::public.ritual_kind then
      v_candidate := ((v_now at time zone v_timezone)::date::timestamp + p_local_time) at time zone v_timezone;
      if v_candidate <= v_now then
        v_candidate := ((((v_now at time zone v_timezone)::date + 1)::timestamp + p_local_time) at time zone v_timezone);
      end if;
    else
      v_days_until := (p_weekday - extract(isodow from v_now at time zone v_timezone)::integer + 7) % 7;
      v_candidate := ((((v_now at time zone v_timezone)::date + v_days_until)::timestamp + p_local_time) at time zone v_timezone);
      if v_candidate <= v_now then
        v_candidate := v_candidate + interval '7 days';
      end if;
    end if;
  end if;

  insert into public.reminder_rules (user_id, ritual_kind, cadence, local_time, weekday, timezone, enabled, next_run_at, is_ritual_schedule)
  values (v_user_id, p_ritual_kind, v_cadence, p_local_time, p_weekday, v_timezone, p_enabled, v_candidate, true)
  on conflict (user_id, ritual_kind) where is_ritual_schedule do update
    set cadence = excluded.cadence,
        local_time = excluded.local_time,
        weekday = excluded.weekday,
        timezone = excluded.timezone,
        enabled = excluded.enabled,
        next_run_at = excluded.next_run_at
  returning reminder_rules.ritual_kind, reminder_rules.cadence, reminder_rules.local_time,
    reminder_rules.weekday, reminder_rules.timezone, reminder_rules.enabled, reminder_rules.next_run_at
  into ritual_kind, cadence, local_time, weekday, timezone, enabled, next_run_at;

  return next;
end;
$$;

revoke all on function public.save_ritual_reminder_schedule(public.ritual_kind, boolean, time, smallint) from public, anon;
grant execute on function public.save_ritual_reminder_schedule(public.ritual_kind, boolean, time, smallint) to authenticated;
