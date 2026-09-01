-- Judge demo: prepare a fictional ledger for one anonymous demo session.
--
-- This RPC is SECURITY INVOKER on purpose. It holds no elevated authority and
-- writes nothing the calling owner could not write through the ordinary
-- application path. Row-level security is what proves a demo session can only
-- ever seed itself; this function relies on that guarantee rather than
-- restating it. Historical days are closed through the same draft -> committed
-- transition an owner performs in the UI, so every seeded commitment event is
-- appended by the existing ledger triggers instead of inserted directly.
--
-- Dates derive from the demo profile timezone at call time, so the seeded week
-- is always the current week. No fixed calendar date appears here.

create function public.seed_demo_ledger()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_timezone constant text := 'America/Chicago';
  v_today date;
  v_week_start date;
  v_last_week_start date;
  v_area_id uuid;
  v_goal_field_guide uuid;
  v_goal_archive uuid;
  v_commitment_chapter uuid;
  v_commitment_checkin uuid;
  v_commitment_archive uuid;
  v_commitment_next uuid;
  v_session_id uuid;
  v_days_committed integer := 0;
  v_day record;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  -- A permanent account owns a real ledger. Refuse to write fiction into it.
  if not v_is_anonymous then
    raise exception 'the demo ledger is only available to a demo session' using errcode = '42501';
  end if;

  -- Never overwrite an existing ledger. A demo session that wants a clean
  -- slate takes a new anonymous identity; committed records stay immutable.
  if exists (select 1 from public.ritual_sessions where user_id = v_user_id) then
    return jsonb_build_object('seeded', false, 'reason', 'already_prepared');
  end if;

  v_today := (now() at time zone v_timezone)::date;
  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);
  v_last_week_start := v_week_start - 7;

  insert into public.profiles (user_id, display_name, timezone)
  values (v_user_id, 'Fictional demo owner', v_timezone)
  on conflict (user_id) do update set timezone = excluded.timezone;

  insert into public.areas (user_id, title, sort_order)
  values (v_user_id, 'Fictional product studio', 1)
  returning id into v_area_id;

  insert into public.goals (user_id, area_id, title, priority)
  values (v_user_id, v_area_id, 'Publish the imaginary field guide', 1)
  returning id into v_goal_field_guide;

  insert into public.goals (user_id, area_id, title, priority)
  values (v_user_id, v_area_id, 'Polish fictional archive labels', 4)
  returning id into v_goal_archive;

  insert into public.key_dates (user_id, goal_id, title, kind, due_on)
  values (
    v_user_id,
    v_goal_field_guide,
    'Imaginary field-guide review',
    'review'::public.key_date_kind,
    v_week_start + 11
  );

  insert into public.commitments (user_id, goal_id, title)
  values (v_user_id, v_goal_field_guide, 'Write the fictional accessibility chapter')
  returning id into v_commitment_chapter;

  insert into public.commitments (user_id, goal_id, title)
  values (v_user_id, v_goal_field_guide, 'Attend the imaginary holiday check-in')
  returning id into v_commitment_checkin;

  insert into public.commitments (user_id, goal_id, title)
  values (v_user_id, v_goal_archive, 'Relabel fictional archive boxes')
  returning id into v_commitment_archive;

  insert into public.commitments (user_id, goal_id, title, due_on)
  values (
    v_user_id,
    v_goal_field_guide,
    'Draft the next imaginary field-guide section',
    v_week_start + 4
  )
  returning id into v_commitment_next;

  -- Only days that have already happened are closed. Today is deliberately
  -- left open so the demo session conducts and commits its own ritual.
  for v_day in
    select day.day_on, day.moved_text, day.blocker_text, day.blocker_type,
           day.previous_commitment_id, day.previous_outcome, day.buried_win
      from (
        values
          -- Last week is seeded as a complete week so the ledger always holds
          -- one fully patterned week, including early in the current week when
          -- little has happened yet.
          (
            v_last_week_start, 'Mapped the imaginary chapter outline.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'partial'::public.commitment_outcome,
            'A reader called the margin notes the best part; that was not the plan.'::text
          ),
          (
            v_last_week_start + 1, 'Rebuilt the imaginary sample spread.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'deferred'::public.commitment_outcome, null::text
          ),
          (
            v_last_week_start + 2, 'Held the imaginary studio review.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_checkin, 'planned_skip'::public.commitment_outcome, null::text
          ),
          (
            v_last_week_start + 3, 'Trimmed the fictional archive backlog.',
            'Short on focused hours.', 'capacity'::public.blocker_type,
            v_commitment_archive, 'done'::public.commitment_outcome, null::text
          ),
          (
            v_last_week_start + 4, 'Reordered the imaginary chapter list.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'not_done'::public.commitment_outcome, null::text
          ),
          (
            v_week_start, 'Outlined the imaginary accessibility chapter.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'partial'::public.commitment_outcome,
            'The cardboard prototype survived the rain; keep that exact phrase.'::text
          ),
          (
            v_week_start + 1, 'Reworked the imaginary outline after board feedback.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'deferred'::public.commitment_outcome, null::text
          ),
          (
            v_week_start + 2, 'Protected the planned holiday block.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_checkin, 'planned_skip'::public.commitment_outcome, null::text
          ),
          (
            v_week_start + 3, 'Relabeled a fictional archive shelf.',
            'Short on focused hours.', 'capacity'::public.blocker_type,
            v_commitment_archive, 'done'::public.commitment_outcome, null::text
          ),
          (
            v_week_start + 4, 'Drafted two imaginary field-guide spreads.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'not_done'::public.commitment_outcome, null::text
          )
      ) as day(
        day_on, moved_text, blocker_text, blocker_type,
        previous_commitment_id, previous_outcome, buried_win
      )
     where day.day_on < v_today
     order by day.day_on
  loop
    insert into public.ritual_sessions (user_id, kind, period_start)
    values (v_user_id, 'daily'::public.ritual_kind, v_day.day_on)
    returning id into v_session_id;

    insert into public.daily_entries (
      user_id, ritual_session_id, moved_text, blocker_text, blocker_type,
      previous_commitment_id, previous_commitment_outcome, next_commitment_id, buried_win
    )
    values (
      v_user_id, v_session_id, v_day.moved_text, v_day.blocker_text, v_day.blocker_type,
      v_day.previous_commitment_id, v_day.previous_outcome, v_commitment_next, v_day.buried_win
    );

    update public.ritual_sessions
       set status = 'committed'::public.ritual_status,
           version = version + 1
     where id = v_session_id
       and user_id = v_user_id;

    v_days_committed := v_days_committed + 1;
  end loop;

  -- Last week's weekly ritual is already closed. The current week stays open so
  -- the weekly close remains the demo session's own decision to make.
  insert into public.ritual_sessions (user_id, kind, period_start)
  values (v_user_id, 'weekly'::public.ritual_kind, v_last_week_start)
  returning id into v_session_id;

  insert into public.weekly_entries (
    user_id, ritual_session_id, missing_metrics, observations,
    decision_text, arrow, priorities
  )
  values (
    v_user_id,
    v_session_id,
    '["Imaginary review cycle time"]'::jsonb,
    '["External gates were visible, not avoidant stalls.", "Archive work kept displacing the field guide."]'::jsonb,
    'Protect the imaginary field-guide review window before taking new archive work.',
    'steady'::public.weekly_arrow,
    jsonb_build_array(
      jsonb_build_object('title', 'Publish the fictional review packet', 'due_on', (v_week_start + 4)::text)
    )
  );

  update public.ritual_sessions
     set status = 'committed'::public.ritual_status,
         version = version + 1
   where id = v_session_id
     and user_id = v_user_id;

  return jsonb_build_object(
    'seeded', true,
    'timezone', v_timezone,
    'week_start', v_week_start,
    'days_committed', v_days_committed
  );
end;
$$;

revoke all on function public.seed_demo_ledger() from public, anon;
grant execute on function public.seed_demo_ledger() to authenticated;
