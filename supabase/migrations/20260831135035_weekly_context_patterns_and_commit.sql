-- Wave 4: bounded weekly context and the ordinary human weekly close.
--
-- Context is scoped to one Monday--Sunday local week.  The server derives
-- the requested Monday in the owner's timezone; this RPC accepts only that
-- bounded date and returns structured, stable finding identifiers.  It does
-- not expose unrestricted history.  WebMCP will be draft-only in Wave 5.

create function gyst_private.weekly_draft_arrays_are_valid(
  p_missing_metrics jsonb,
  p_observations jsonb,
  p_priorities jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    jsonb_typeof(p_missing_metrics) = 'array'
    and jsonb_array_length(p_missing_metrics) <= 12
    and not exists (
      select 1
      from jsonb_array_elements(p_missing_metrics) as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or char_length(item.value #>> '{}') > 500
    )
    and jsonb_typeof(p_observations) = 'array'
    and jsonb_array_length(p_observations) <= 12
    and not exists (
      select 1
      from jsonb_array_elements(p_observations) as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or char_length(item.value #>> '{}') > 2000
    )
    and jsonb_typeof(p_priorities) = 'array'
    and jsonb_array_length(p_priorities) <= 5
    and not exists (
      select 1
      from jsonb_array_elements(p_priorities) as item(value)
      where jsonb_typeof(item.value) <> 'object'
        or jsonb_typeof(item.value -> 'title') <> 'string'
        or char_length(item.value ->> 'title') not between 1 and 500
        or jsonb_typeof(item.value -> 'due_on') <> 'string'
        or (item.value ->> 'due_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or (item.value ->> 'due_on')::date is null
    );
$$;

revoke execute on function gyst_private.weekly_draft_arrays_are_valid(jsonb, jsonb, jsonb) from public, anon, authenticated;
-- The invoker-only public draft RPC calls this private validator. Schema usage
-- and this pure, argument-only validator is the sole helper callable by the
-- authenticated role. It has no table access and cannot mutate the ledger.
grant usage on schema gyst_private to authenticated;
grant execute on function gyst_private.weekly_draft_arrays_are_valid(jsonb, jsonb, jsonb) to authenticated;

-- Wave 3's policy allowed only its daily close trigger to transition a draft.
-- The same ordinary authenticated path may now close a complete weekly draft;
-- the trigger below is the ledger-level validation for that transition.
drop policy ritual_sessions_update_own_draft on public.ritual_sessions;

create policy ritual_sessions_update_own_draft on public.ritual_sessions
for update to authenticated
using ((select auth.uid()) = user_id and status = 'draft')
with check (
  (select auth.uid()) = user_id
  and (
    (status = 'draft' and committed_at is null)
    or (status = 'committed' and kind in ('daily'::public.ritual_kind, 'weekly'::public.ritual_kind))
  )
);

create function gyst_private.complete_weekly_ritual_commit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry public.weekly_entries%rowtype;
begin
  if old.status <> 'draft'::public.ritual_status
    or new.status <> 'committed'::public.ritual_status
    or new.kind <> 'weekly'::public.ritual_kind then
    return new;
  end if;

  select * into v_entry
    from public.weekly_entries
   where user_id = new.user_id and ritual_session_id = new.id
   for key share;

  if not found or v_entry.decision_text is null or v_entry.arrow is null or jsonb_array_length(v_entry.priorities) = 0 then
    raise exception 'add a decision, an arrow, and at least one dated priority before closing' using errcode = '23514';
  end if;

  new.committed_at := now();
  return new;
end;
$$;

revoke execute on function gyst_private.complete_weekly_ritual_commit() from public, anon, authenticated;

create trigger ritual_sessions_complete_weekly_commit
before update on public.ritual_sessions
for each row execute function gyst_private.complete_weekly_ritual_commit();

create function public.get_weekly_context(p_week_start date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_week_end date;
  v_findings jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if extract(isodow from p_week_start) <> 1 then
    raise exception 'weekly context must start on Monday' using errcode = '22023';
  end if;

  select profile.timezone
    into v_timezone
    from public.profiles as profile
   where profile.user_id = v_user_id;

  if not found then
    raise exception 'profile is required for weekly context' using errcode = '42501';
  end if;

  -- Validate the stored IANA timezone before constructing its local bounds.
  perform now() at time zone v_timezone;
  v_week_end := p_week_start + 6;

  with daily_in_week as (
    select entry.*, session.period_start
      from public.daily_entries as entry
      join public.ritual_sessions as session
        on session.user_id = entry.user_id
       and session.id = entry.ritual_session_id
     where entry.user_id = v_user_id
       and session.kind = 'daily'::public.ritual_kind
       and session.status = 'committed'::public.ritual_status
       and session.period_start between p_week_start and v_week_end
  ), findings as (
    select
      'repeated_noncompletion:' || event.commitment_id::text as finding_id,
      'repeated_noncompletion' as finding_type,
      jsonb_build_object(
        'commitment_id', event.commitment_id,
        'title_snapshot', min(event.title_snapshot),
        'count', count(*),
        'outcomes', jsonb_agg(event.outcome order by event.event_on, event.id)
      ) as detail
    from public.commitment_events as event
    where event.user_id = v_user_id
      and event.event_on between p_week_start and v_week_end
      and event.outcome in ('partial'::public.commitment_outcome, 'deferred'::public.commitment_outcome, 'not_done'::public.commitment_outcome)
    group by event.commitment_id
    having count(*) >= 2

    union all

    select
      'blocker_recurrence:' || daily.blocker_type::text as finding_id,
      'blocker_recurrence' as finding_type,
      jsonb_build_object(
        'blocker_type', daily.blocker_type,
        'count', count(*),
        'avoidant_stall', false
      ) as detail
    from daily_in_week as daily
    where daily.blocker_type is not null
    group by daily.blocker_type
    having count(*) >= 3

    union all

    select
      'buried_win:' || daily.id::text as finding_id,
      'buried_win' as finding_type,
      jsonb_build_object('daily_entry_id', daily.id, 'text', daily.buried_win) as detail
    from daily_in_week as daily
    where daily.buried_win is not null

    union all

    select
      'outside_priorities:' || event.id::text as finding_id,
      'outside_priorities' as finding_type,
      jsonb_build_object(
        'commitment_id', event.commitment_id,
        'title_snapshot', event.title_snapshot,
        'event_on', event.event_on
      ) as detail
    from public.commitment_events as event
    left join public.commitments as commitment
      on commitment.user_id = event.user_id
     and commitment.id = event.commitment_id
    left join public.goals as goal
      on goal.user_id = commitment.user_id
     and goal.id = commitment.goal_id
    where event.user_id = v_user_id
      and event.event_on between p_week_start and v_week_end
      and (goal.id is null or goal.status <> 'active'::public.goal_status or goal.priority > 2)

    union all

    select
      'approaching_key_date:' || key_date.id::text as finding_id,
      'approaching_key_date' as finding_type,
      jsonb_build_object(
        'key_date_id', key_date.id,
        'title', key_date.title,
        'kind', key_date.kind,
        'due_on', key_date.due_on,
        'days_away', key_date.due_on - p_week_start
      ) as detail
    from public.key_dates as key_date
    where key_date.user_id = v_user_id
      and key_date.completed_at is null
      and key_date.due_on between p_week_start and p_week_start + 20
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', finding_id, 'type', finding_type, 'detail', detail) order by finding_id), '[]'::jsonb)
    into v_findings
    from findings;

  return jsonb_build_object(
    'timezone', v_timezone,
    'week_start', p_week_start,
    'week_end', v_week_end,
    'findings', v_findings
  );
end;
$$;

revoke all on function public.get_weekly_context(date) from public, anon;
grant execute on function public.get_weekly_context(date) to authenticated;

create function public.save_weekly_ritual_draft(
  p_period_start date,
  p_draft jsonb,
  p_expected_session_version bigint default null
)
returns table (
  ritual_session_id uuid,
  status public.ritual_status,
  version bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ritual_sessions%rowtype;
  v_created_session boolean := false;
  v_missing_metrics jsonb;
  v_observations jsonb;
  v_priorities jsonb;
  v_decision_text text;
  v_arrow public.weekly_arrow;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if extract(isodow from p_period_start) <> 1 then
    raise exception 'weekly ritual must start on Monday' using errcode = '22023';
  end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception 'weekly draft must be an object' using errcode = '22023';
  end if;

  v_missing_metrics := coalesce(p_draft -> 'missing_metrics', '[]'::jsonb);
  v_observations := coalesce(p_draft -> 'observations', '[]'::jsonb);
  v_priorities := coalesce(p_draft -> 'priorities', '[]'::jsonb);
  v_decision_text := nullif(btrim(p_draft ->> 'decision_text'), '');
  v_arrow := nullif(p_draft ->> 'arrow', '')::public.weekly_arrow;

  if not gyst_private.weekly_draft_arrays_are_valid(v_missing_metrics, v_observations, v_priorities)
    or (v_decision_text is not null and char_length(v_decision_text) > 12000) then
    raise exception 'weekly draft fields are invalid' using errcode = '22023';
  end if;

  select * into v_session
    from public.ritual_sessions
   where user_id = v_user_id and kind = 'weekly'::public.ritual_kind and period_start = p_period_start
   for update;

  if not found then
    if p_expected_session_version is not null then
      raise exception 'weekly ritual draft has changed; refresh before saving' using errcode = '40001';
    end if;
    insert into public.ritual_sessions (user_id, kind, period_start)
    values (v_user_id, 'weekly'::public.ritual_kind, p_period_start)
    on conflict (user_id, kind, period_start) do nothing
    returning * into v_session;
    if not found then
      raise exception 'weekly ritual draft has changed; refresh before saving' using errcode = '40001';
    end if;
    v_created_session := true;
  end if;

  if v_session.status <> 'draft'::public.ritual_status then
    raise exception 'this weekly ritual is already committed' using errcode = '23514';
  end if;
  if not v_created_session and (p_expected_session_version is null or v_session.version <> p_expected_session_version) then
    raise exception 'weekly ritual draft has changed; refresh before saving' using errcode = '40001';
  end if;

  insert into public.weekly_entries (user_id, ritual_session_id, missing_metrics, observations, decision_text, arrow, priorities)
  values (v_user_id, v_session.id, v_missing_metrics, v_observations, v_decision_text, v_arrow, v_priorities)
  on conflict on constraint weekly_entries_session_key do update
    set missing_metrics = excluded.missing_metrics,
        observations = excluded.observations,
        decision_text = excluded.decision_text,
        arrow = excluded.arrow,
        priorities = excluded.priorities,
        version = public.weekly_entries.version + 1;

  if not v_created_session then
    update public.ritual_sessions as session
       set version = session.version + 1
     where session.user_id = v_user_id and session.id = v_session.id
    returning session.* into v_session;
  end if;

  return query select v_session.id, v_session.status, v_session.version;
end;
$$;

create function public.commit_weekly_ritual(
  p_ritual_session_id uuid,
  p_expected_version bigint
)
returns table (ritual_session_id uuid, committed_at timestamptz, version bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ritual_sessions%rowtype;
  v_entry public.weekly_entries%rowtype;
begin
  if v_user_id is null then raise exception 'authentication is required' using errcode = '42501'; end if;
  select * into v_session from public.ritual_sessions
   where id = p_ritual_session_id and user_id = v_user_id;
  if not found then raise exception 'weekly ritual session was not found' using errcode = '42501'; end if;
  if v_session.kind <> 'weekly'::public.ritual_kind then raise exception 'only weekly ritual sessions can use this commit path' using errcode = '23514'; end if;
  if v_session.status = 'committed'::public.ritual_status then
    return query select v_session.id, v_session.committed_at, v_session.version; return;
  end if;
  if p_expected_version is null then raise exception 'weekly ritual draft has changed; refresh before committing' using errcode = '40001'; end if;

  select * into v_session from public.ritual_sessions
   where id = p_ritual_session_id and user_id = v_user_id and status = 'draft'::public.ritual_status for update;
  if not found or v_session.version <> p_expected_version then
    raise exception 'weekly ritual draft has changed; refresh before committing' using errcode = '40001';
  end if;
  select entry.* into v_entry from public.weekly_entries as entry
   where entry.user_id = v_user_id and entry.ritual_session_id = v_session.id for key share;
  if not found or v_entry.decision_text is null or v_entry.arrow is null or jsonb_array_length(v_entry.priorities) = 0 then
    raise exception 'add a decision, an arrow, and at least one dated priority before closing' using errcode = '23514';
  end if;
  update public.ritual_sessions as session
     set status = 'committed'::public.ritual_status, version = session.version + 1
   where session.id = v_session.id and session.user_id = v_user_id
  returning session.* into v_session;
  return query select v_session.id, v_session.committed_at, v_session.version;
end;
$$;

revoke all on function public.save_weekly_ritual_draft(date, jsonb, bigint) from public, anon;
grant execute on function public.save_weekly_ritual_draft(date, jsonb, bigint) to authenticated;
revoke all on function public.commit_weekly_ritual(uuid, bigint) from public, anon;
grant execute on function public.commit_weekly_ritual(uuid, bigint) to authenticated;
