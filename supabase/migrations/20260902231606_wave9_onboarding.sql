-- Wave 9: first-run onboarding and the commitment lifecycle.
--
-- A signed-up owner has no areas, goals, or commitments, so the first daily
-- ritual cannot be committed. This migration adds the founding statement: one
-- jsonb staging record per owner with the daily ritual's optimistic-concurrency
-- shape, fanned out by a single commit into areas, goals, key dates, and
-- commitments in one transaction, plus a system-titled founding commitment the
-- first daily ritual scores. Completion is gated on profiles.onboarded_at, never
-- derived from what the owner currently owns.
--
-- Every function here is SECURITY INVOKER. The fan-out runs at the ledger
-- boundary, inside the draft -> committed transition, exactly as the daily
-- close does, so the update policy's committed allowance can never skip it.

alter table public.profiles add column onboarded_at timestamptz;

-- One-time recognition of ledgers that already work. After this statement the
-- column alone decides; nothing derives onboarding from owned rows at runtime.
update public.profiles as profile
   set onboarded_at = now()
 where profile.onboarded_at is null
   and (
     exists (
       select 1 from public.commitments as commitment
        where commitment.user_id = profile.user_id
     )
     or exists (
       select 1 from public.ritual_sessions as session
        where session.user_id = profile.user_id
          and session.status = 'committed'::public.ritual_status
     )
   );

create table public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  status public.ritual_status not null default 'draft',
  founding_commitment_id uuid,
  version bigint not null default 1,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_drafts_user_id_key unique (user_id),
  constraint onboarding_drafts_user_id_id_key unique (user_id, id),
  constraint onboarding_drafts_founding_commitment_fkey foreign key (user_id, founding_commitment_id)
    references public.commitments (user_id, id) on delete restrict,
  constraint onboarding_drafts_draft_check check (jsonb_typeof(draft) = 'object'),
  constraint onboarding_drafts_commit_check check (
    (status = 'draft' and committed_at is null and founding_commitment_id is null)
    or (status = 'committed' and committed_at is not null and founding_commitment_id is not null)
  ),
  constraint onboarding_drafts_version_check check (version > 0),
  constraint onboarding_drafts_timestamps_check check (updated_at >= created_at)
);

create index onboarding_drafts_user_founding_commitment_idx
  on public.onboarding_drafts (user_id, founding_commitment_id)
  where founding_commitment_id is not null;

-- Pure, argument-only validators for the draft payload. They read no table and
-- cannot mutate the ledger; the commit trigger below calls them under the
-- ordinary owner role, which is why they are the only new helpers the
-- authenticated role may execute (the same arrangement as the weekly validator).
create function gyst_private.onboarding_draft_text(
  p_value jsonb,
  p_field text,
  p_max_length integer,
  p_required boolean
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_text text;
begin
  if p_value is not null and jsonb_typeof(p_value) not in ('string', 'null') then
    raise exception '% must be text', p_field using errcode = '22023';
  end if;

  v_text := nullif(btrim(p_value #>> '{}'), '');

  if v_text is null then
    if p_required then
      raise exception '% is required', p_field using errcode = '22023';
    end if;
    return null;
  end if;

  if char_length(v_text) > p_max_length then
    raise exception '% must be at most % characters', p_field, p_max_length using errcode = '22023';
  end if;

  return v_text;
end;
$$;

create function gyst_private.onboarding_draft_date(
  p_value jsonb,
  p_field text,
  p_required boolean
)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    if p_required then
      raise exception '% is required', p_field using errcode = '22023';
    end if;
    return null;
  end if;

  v_text := p_value #>> '{}';

  if jsonb_typeof(p_value) <> 'string' or v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception '% must be a YYYY-MM-DD date', p_field using errcode = '22023';
  end if;

  begin
    return v_text::date;
  exception
    when others then
      raise exception '% must be a YYYY-MM-DD date', p_field using errcode = '22023';
  end;
end;
$$;

-- Once committed, the founding statement can never be updated or deleted.
-- Whole-account deletion still cascades: the same marker-plus-depth test the
-- other immutable-ledger guards use.
create function gyst_private.guard_onboarding_draft_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and pg_trigger_depth() > 1
    and old.user_id::text = any (
      string_to_array(coalesce(current_setting('gyst.account_deletion_user_ids', true), ''), ',')
    )
  then
    return old;
  end if;

  if old.status = 'committed'::public.ritual_status then
    raise exception 'committed onboarding drafts are immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- The founding commit. Fires only on the draft -> committed transition and
-- performs the whole fan-out inside that statement, so a rejected draft rolls
-- every row back and no path to 'committed' can skip validation.
--
-- Draft contract (field names are fixed; keys are client-side handles used only
-- to resolve relations here and are never stored):
--   display_name: string | null                     (1..120)
--   timezone:     string                            (required, valid IANA zone)
--   areas:        [{ key, title, description }]     (1..8;  title 1..160, description <= 4000)
--   goals:        [{ key, area_key, title, description, target_date, priority }]
--                                                   (1..12; title 1..240, description <= 8000, priority 1..5)
--   key_dates:    [{ goal_key, title, kind, due_on, notes }]
--                                                   (0..24; title 1..240, notes <= 8000; may be absent)
--   commitments:  [{ goal_key, title, details, due_on }]
--                                                   (1..12; title 1..500, details <= 8000)
create function gyst_private.complete_onboarding_commit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c_founding_title constant text := 'Founded this GYST ledger';
  v_draft jsonb;
  v_display_name text;
  v_timezone text;
  v_today date;
  v_items jsonb;
  v_item jsonb;
  v_position integer;
  v_key text;
  v_parent_key text;
  v_title text;
  v_kind text;
  v_priority numeric;
  v_area_ids jsonb := '{}'::jsonb;
  v_goal_ids jsonb := '{}'::jsonb;
  v_goal_area_ids jsonb := '{}'::jsonb;
  v_area_id uuid;
  v_goal_id uuid;
  v_commitment_id uuid;
  v_commitment_ids uuid[] := array[]::uuid[];
  v_founding_commitment_id uuid;
  v_active_count integer;
begin
  if old.status <> 'draft'::public.ritual_status
    or new.status <> 'committed'::public.ritual_status then
    return new;
  end if;

  v_draft := new.draft;

  if v_draft is null or jsonb_typeof(v_draft) <> 'object' then
    raise exception 'onboarding draft must be an object' using errcode = '22023';
  end if;

  v_display_name := gyst_private.onboarding_draft_text(v_draft -> 'display_name', 'display_name', 120, false);
  v_timezone := gyst_private.onboarding_draft_text(v_draft -> 'timezone', 'timezone', 100, true);

  -- Exact IANA name only. "at time zone" would also accept POSIX strings such
  -- as UTC+5, whose sign is inverted and which the application cannot format.
  select zone.name
    into v_timezone
    from pg_catalog.pg_timezone_names as zone
   where zone.name = v_timezone;

  if v_timezone is null then
    raise exception 'timezone must be a valid IANA time zone name' using errcode = '22023';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  -- Areas, in array order.
  v_items := v_draft -> 'areas';

  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'areas must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(v_items) not between 1 and 8 then
    raise exception 'areas must contain between 1 and 8 entries' using errcode = '22023';
  end if;

  for v_item, v_position in
    select element.value, element.ordinality
      from jsonb_array_elements(v_items) with ordinality as element(value, ordinality)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'each area must be an object' using errcode = '22023';
    end if;

    v_key := gyst_private.onboarding_draft_text(v_item -> 'key', 'area key', 120, true);

    if v_area_ids ? v_key then
      raise exception 'area keys must be unique' using errcode = '22023';
    end if;

    insert into public.areas (user_id, title, description, sort_order)
    values (
      new.user_id,
      gyst_private.onboarding_draft_text(v_item -> 'title', 'area title', 160, true),
      gyst_private.onboarding_draft_text(v_item -> 'description', 'area description', 4000, false),
      v_position
    )
    returning id into v_area_id;

    v_area_ids := v_area_ids || jsonb_build_object(v_key, v_area_id::text);
  end loop;

  -- Goals, each under an area from this draft.
  v_items := v_draft -> 'goals';

  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'goals must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(v_items) not between 1 and 12 then
    raise exception 'goals must contain between 1 and 12 entries' using errcode = '22023';
  end if;

  for v_item in select element.value from jsonb_array_elements(v_items) as element(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'each goal must be an object' using errcode = '22023';
    end if;

    v_key := gyst_private.onboarding_draft_text(v_item -> 'key', 'goal key', 120, true);

    if v_goal_ids ? v_key then
      raise exception 'goal keys must be unique' using errcode = '22023';
    end if;

    v_parent_key := gyst_private.onboarding_draft_text(v_item -> 'area_key', 'goal area_key', 120, true);

    if not (v_area_ids ? v_parent_key) then
      raise exception 'goal references an unknown area key' using errcode = '22023';
    end if;

    if jsonb_typeof(v_item -> 'priority') is distinct from 'number' then
      raise exception 'goal priority must be a whole number from 1 to 5' using errcode = '22023';
    end if;

    v_priority := (v_item ->> 'priority')::numeric;

    if v_priority <> trunc(v_priority) or v_priority not between 1 and 5 then
      raise exception 'goal priority must be a whole number from 1 to 5' using errcode = '22023';
    end if;

    v_area_id := (v_area_ids ->> v_parent_key)::uuid;

    insert into public.goals (user_id, area_id, title, description, target_date, priority)
    values (
      new.user_id,
      v_area_id,
      gyst_private.onboarding_draft_text(v_item -> 'title', 'goal title', 240, true),
      gyst_private.onboarding_draft_text(v_item -> 'description', 'goal description', 8000, false),
      gyst_private.onboarding_draft_date(v_item -> 'target_date', 'goal target_date', false),
      v_priority::smallint
    )
    returning id into v_goal_id;

    v_goal_ids := v_goal_ids || jsonb_build_object(v_key, v_goal_id::text);
    v_goal_area_ids := v_goal_area_ids || jsonb_build_object(v_key, v_area_id::text);
  end loop;

  -- Key dates are optional; each inherits its area from its goal.
  v_items := coalesce(v_draft -> 'key_dates', '[]'::jsonb);

  if jsonb_typeof(v_items) = 'null' then
    v_items := '[]'::jsonb;
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'key_dates must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(v_items) > 24 then
    raise exception 'key_dates must contain at most 24 entries' using errcode = '22023';
  end if;

  for v_item in select element.value from jsonb_array_elements(v_items) as element(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'each key date must be an object' using errcode = '22023';
    end if;

    v_parent_key := gyst_private.onboarding_draft_text(v_item -> 'goal_key', 'key date goal_key', 120, true);

    if not (v_goal_ids ? v_parent_key) then
      raise exception 'key date references an unknown goal key' using errcode = '22023';
    end if;

    v_kind := gyst_private.onboarding_draft_text(v_item -> 'kind', 'key date kind', 20, true);

    if v_kind not in ('deadline', 'milestone', 'event', 'review') then
      raise exception 'key date kind must be deadline, milestone, event, or review' using errcode = '22023';
    end if;

    insert into public.key_dates (user_id, area_id, goal_id, title, kind, due_on, notes)
    values (
      new.user_id,
      (v_goal_area_ids ->> v_parent_key)::uuid,
      (v_goal_ids ->> v_parent_key)::uuid,
      gyst_private.onboarding_draft_text(v_item -> 'title', 'key date title', 240, true),
      v_kind::public.key_date_kind,
      gyst_private.onboarding_draft_date(v_item -> 'due_on', 'key date due_on', true),
      gyst_private.onboarding_draft_text(v_item -> 'notes', 'key date notes', 8000, false)
    );
  end loop;

  -- First commitments, each under a goal from this draft, each with the same
  -- created event add_commitment appends.
  v_items := v_draft -> 'commitments';

  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'commitments must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(v_items) not between 1 and 12 then
    raise exception 'commitments must contain between 1 and 12 entries' using errcode = '22023';
  end if;

  for v_item in select element.value from jsonb_array_elements(v_items) as element(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'each commitment must be an object' using errcode = '22023';
    end if;

    v_parent_key := gyst_private.onboarding_draft_text(v_item -> 'goal_key', 'commitment goal_key', 120, true);

    if not (v_goal_ids ? v_parent_key) then
      raise exception 'commitment references an unknown goal key' using errcode = '22023';
    end if;

    v_title := gyst_private.onboarding_draft_text(v_item -> 'title', 'commitment title', 500, true);

    insert into public.commitments (user_id, goal_id, title, details, due_on)
    values (
      new.user_id,
      (v_goal_ids ->> v_parent_key)::uuid,
      v_title,
      gyst_private.onboarding_draft_text(v_item -> 'details', 'commitment details', 8000, false),
      gyst_private.onboarding_draft_date(v_item -> 'due_on', 'commitment due_on', false)
    )
    returning id into v_commitment_id;

    insert into public.commitment_events (user_id, commitment_id, kind, title_snapshot, event_on)
    values (new.user_id, v_commitment_id, 'created'::public.commitment_event_kind, v_title, v_today);

    v_commitment_ids := v_commitment_ids || v_commitment_id;
  end loop;

  -- The founding commitment: titled by the system, already kept. It records
  -- that the owner founded the ledger on this date, which is true, and gives
  -- the first daily ritual a previous commitment to score.
  insert into public.commitments (user_id, goal_id, title, state, completed_at)
  values (new.user_id, null, c_founding_title, 'completed'::public.commitment_state, now())
  returning id into v_founding_commitment_id;

  insert into public.commitment_events (user_id, commitment_id, kind, title_snapshot, event_on)
  values (new.user_id, v_founding_commitment_id, 'created'::public.commitment_event_kind, c_founding_title, v_today);

  -- The limits above already force this; assert it anyway, because a founding
  -- commit that leaves /daily with nothing active to choose repairs nothing.
  select count(*)
    into v_active_count
    from public.commitments as commitment
   where commitment.user_id = new.user_id
     and commitment.id = any (v_commitment_ids)
     and commitment.state = 'active'::public.commitment_state;

  if v_active_count < 1 then
    raise exception 'onboarding must create at least one active commitment' using errcode = '23514';
  end if;

  -- Onboarding is where the profile timezone is set explicitly. A missing
  -- profile row counts as not onboarded, so the row is created here if needed.
  insert into public.profiles (user_id, display_name, timezone, onboarded_at)
  values (new.user_id, v_display_name, v_timezone, now())
  on conflict (user_id) do update
    set display_name = coalesce(excluded.display_name, profiles.display_name),
        timezone = excluded.timezone,
        onboarded_at = coalesce(profiles.onboarded_at, now()),
        version = profiles.version + 1;

  new.committed_at := now();
  new.founding_commitment_id := v_founding_commitment_id;

  return new;
end;
$$;

revoke execute on function gyst_private.onboarding_draft_text(jsonb, text, integer, boolean) from public, anon, authenticated;
revoke execute on function gyst_private.onboarding_draft_date(jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function gyst_private.guard_onboarding_draft_mutation() from public, anon, authenticated;
revoke execute on function gyst_private.complete_onboarding_commit() from public, anon, authenticated;
grant execute on function gyst_private.onboarding_draft_text(jsonb, text, integer, boolean) to authenticated;
grant execute on function gyst_private.onboarding_draft_date(jsonb, text, boolean) to authenticated;

create trigger onboarding_drafts_set_updated_at
before update on public.onboarding_drafts
for each row execute function gyst_private.set_updated_at();

create trigger onboarding_drafts_preserve_identity
before update on public.onboarding_drafts
for each row execute function gyst_private.preserve_stable_identity();

create trigger onboarding_drafts_guard_committed
before update or delete on public.onboarding_drafts
for each row execute function gyst_private.guard_onboarding_draft_mutation();

create trigger onboarding_drafts_complete_commit
before update on public.onboarding_drafts
for each row execute function gyst_private.complete_onboarding_commit();

-- Explicit Data API surface: anon receives nothing; authenticated may read,
-- create, and update its own draft. There is no delete grant and no delete
-- policy. The founding statement is a ledger record, not scratch space.
revoke all on table public.onboarding_drafts from public, anon, authenticated;
grant select, insert, update on table public.onboarding_drafts to authenticated;

alter table public.onboarding_drafts enable row level security;

create policy onboarding_drafts_select_own on public.onboarding_drafts
for select to authenticated using ((select auth.uid()) = user_id);
create policy onboarding_drafts_insert_own on public.onboarding_drafts
for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'draft' and committed_at is null);
create policy onboarding_drafts_update_own_draft on public.onboarding_drafts
for update to authenticated
using ((select auth.uid()) = user_id and status = 'draft')
with check (
  (select auth.uid()) = user_id
  and (
    (status = 'draft' and committed_at is null)
    or status = 'committed'
  )
);

-- Draft save. Never commits; stores the payload verbatim after shape checks.
create function public.save_onboarding_draft(
  p_draft jsonb,
  p_expected_version bigint default null
)
returns table (
  onboarding_draft_id uuid,
  status public.ritual_status,
  version bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.onboarding_drafts%rowtype;
  v_created boolean := false;
  v_field text;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  -- A demo session receives its fictional ledger from seed_demo_ledger() and
  -- must never found a real one.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'demo sessions cannot onboard' using errcode = '42501';
  end if;

  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception 'onboarding draft must be an object' using errcode = '22023';
  end if;

  if octet_length(p_draft::text) > 262144 then
    raise exception 'onboarding draft is too large' using errcode = '22023';
  end if;

  foreach v_field in array array['display_name', 'timezone']
  loop
    if p_draft ? v_field and jsonb_typeof(p_draft -> v_field) not in ('string', 'null') then
      raise exception '% must be text or null', v_field using errcode = '22023';
    end if;
  end loop;

  foreach v_field in array array['areas', 'goals', 'key_dates', 'commitments']
  loop
    if p_draft ? v_field and jsonb_typeof(p_draft -> v_field) not in ('array', 'null') then
      raise exception '% must be an array or null', v_field using errcode = '22023';
    end if;
  end loop;

  -- A committed row is invisible to the row lock below because the update
  -- policy excludes it, so check its status first and answer precisely.
  select *
    into v_draft
    from public.onboarding_drafts as existing
   where existing.user_id = v_user_id;

  if found and v_draft.status <> 'draft'::public.ritual_status then
    raise exception 'onboarding is already committed' using errcode = '23514';
  end if;

  select *
    into v_draft
    from public.onboarding_drafts as existing
   where existing.user_id = v_user_id
     and existing.status = 'draft'::public.ritual_status
   for update;

  if not found then
    if p_expected_version is not null then
      raise exception 'onboarding draft has changed; refresh before saving' using errcode = '40001';
    end if;

    insert into public.onboarding_drafts (user_id, draft)
    values (v_user_id, p_draft)
    on conflict (user_id) do nothing
    returning * into v_draft;

    if not found then
      raise exception 'onboarding draft has changed; refresh before saving' using errcode = '40001';
    end if;

    v_created := true;
  end if;

  if v_draft.status <> 'draft'::public.ritual_status then
    raise exception 'onboarding is already committed' using errcode = '23514';
  end if;

  if not v_created
    and (p_expected_version is null or v_draft.version <> p_expected_version) then
    raise exception 'onboarding draft has changed; refresh before saving' using errcode = '40001';
  end if;

  if not v_created then
    update public.onboarding_drafts as existing
       set draft = p_draft,
           version = existing.version + 1
     where existing.id = v_draft.id
       and existing.user_id = v_user_id
    returning existing.* into v_draft;
  end if;

  return query select v_draft.id, v_draft.status, v_draft.version;
end;
$$;

revoke all on function public.save_onboarding_draft(jsonb, bigint) from public, anon;
grant execute on function public.save_onboarding_draft(jsonb, bigint) to authenticated;

-- The founding commit. Optimistic, idempotent on replay, and validated at the
-- ledger boundary by the trigger above inside this one update.
create function public.commit_onboarding(
  p_onboarding_draft_id uuid,
  p_expected_version bigint
)
returns table (
  onboarding_draft_id uuid,
  committed_at timestamptz,
  version bigint,
  founding_commitment_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.onboarding_drafts%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'demo sessions cannot onboard' using errcode = '42501';
  end if;

  select *
    into v_draft
    from public.onboarding_drafts as existing
   where existing.id = p_onboarding_draft_id
     and existing.user_id = v_user_id;

  if not found then
    raise exception 'onboarding draft was not found' using errcode = '42501';
  end if;

  if v_draft.status = 'committed'::public.ritual_status then
    return query select v_draft.id, v_draft.committed_at, v_draft.version, v_draft.founding_commitment_id;
    return;
  end if;

  select *
    into v_draft
    from public.onboarding_drafts as existing
   where existing.id = p_onboarding_draft_id
     and existing.user_id = v_user_id
     and existing.status = 'draft'::public.ritual_status
   for update;

  if not found then
    select *
      into v_draft
      from public.onboarding_drafts as existing
     where existing.id = p_onboarding_draft_id
       and existing.user_id = v_user_id;

    if found and v_draft.status = 'committed'::public.ritual_status then
      return query select v_draft.id, v_draft.committed_at, v_draft.version, v_draft.founding_commitment_id;
      return;
    end if;

    raise exception 'onboarding draft has changed; refresh before committing' using errcode = '40001';
  end if;

  if p_expected_version is null or v_draft.version <> p_expected_version then
    raise exception 'onboarding draft has changed; refresh before committing' using errcode = '40001';
  end if;

  update public.onboarding_drafts as existing
     set status = 'committed'::public.ritual_status,
         version = existing.version + 1
   where existing.id = v_draft.id
     and existing.user_id = v_user_id
  returning existing.* into v_draft;

  return query select v_draft.id, v_draft.committed_at, v_draft.version, v_draft.founding_commitment_id;
end;
$$;

revoke all on function public.commit_onboarding(uuid, bigint) from public, anon;
grant execute on function public.commit_onboarding(uuid, bigint) to authenticated;

-- The ongoing pump: one active commitment under an owned active goal, with the
-- same created event the founding commit appends. Human-only by capability
-- contract; WebMCP never receives this tool.
create function public.add_commitment(
  p_goal_id uuid,
  p_title text,
  p_details text default null,
  p_due_on date default null
)
returns table (
  commitment_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
  v_title text := nullif(btrim(p_title), '');
  v_details text := nullif(btrim(p_details), '');
  v_timezone text;
  v_commitment_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_title is null or char_length(v_title) > 500 then
    raise exception 'commitment title must be between 1 and 500 characters' using errcode = '22023';
  end if;

  if v_details is not null and char_length(v_details) > 8000 then
    raise exception 'commitment details must be at most 8000 characters' using errcode = '22023';
  end if;

  select *
    into v_goal
    from public.goals as goal
   where goal.id = p_goal_id
     and goal.user_id = v_user_id
   for key share;

  if not found then
    raise exception 'goal was not found' using errcode = '42501';
  end if;

  if v_goal.status <> 'active'::public.goal_status then
    raise exception 'commitments can only be added to an active goal' using errcode = '23514';
  end if;

  select profile.timezone
    into v_timezone
    from public.profiles as profile
   where profile.user_id = v_user_id;

  insert into public.commitments (user_id, goal_id, title, details, due_on)
  values (v_user_id, v_goal.id, v_title, v_details, p_due_on)
  returning id into v_commitment_id;

  insert into public.commitment_events (user_id, commitment_id, kind, title_snapshot, event_on)
  values (
    v_user_id,
    v_commitment_id,
    'created'::public.commitment_event_kind,
    v_title,
    (now() at time zone coalesce(v_timezone, 'UTC'))::date
  );

  return query select v_commitment_id;
end;
$$;

revoke all on function public.add_commitment(uuid, text, text, date) from public, anon;
grant execute on function public.add_commitment(uuid, text, text, date) to authenticated;

-- The demo session must never meet the onboarding gate. The seed marks its
-- profile onboarded; the fictional persona and calendar are otherwise unchanged.
create or replace function public.seed_demo_ledger()
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

  -- Never overwrite or extend an existing ledger, however it came to exist.
  -- A demo session that wants a clean slate takes a new anonymous identity;
  -- committed records stay immutable.
  if exists (select 1 from public.ritual_sessions where user_id = v_user_id)
    or exists (select 1 from public.areas where user_id = v_user_id)
    or exists (select 1 from public.goals where user_id = v_user_id)
    or exists (select 1 from public.commitments where user_id = v_user_id)
    or exists (select 1 from public.onboarding_drafts where user_id = v_user_id)
  then
    return jsonb_build_object('seeded', false, 'reason', 'already_prepared');
  end if;

  v_today := (now() at time zone v_timezone)::date;
  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);
  v_last_week_start := v_week_start - 7;

  insert into public.profiles (user_id, display_name, timezone, onboarded_at)
  values (v_user_id, 'Fictional demo owner', v_timezone, now())
  on conflict (user_id) do update set timezone = excluded.timezone, onboarded_at = now();

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
  --
  -- Each day's next commitment is the one the following day scores, so the
  -- carried promise and the promise kept are the same record. A reader who
  -- follows the chain finds it closes; the last closed day hands its action to
  -- the open day, which is the one the demo session decides.
  for v_day in
    select day.day_on, day.moved_text, day.blocker_text, day.blocker_type,
           day.previous_commitment_id, day.previous_outcome,
           day.next_commitment_id, day.buried_win
      from (
        values
          -- Last week is seeded as a complete week so the ledger always holds
          -- one fully patterned week, including early in the current week when
          -- little has happened yet.
          (
            v_last_week_start, 'Mapped the imaginary chapter outline.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'partial'::public.commitment_outcome, v_commitment_chapter,
            'A reader called the margin notes the best part; that was not the plan.'::text
          ),
          (
            v_last_week_start + 1, 'Rebuilt the imaginary sample spread.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'deferred'::public.commitment_outcome, v_commitment_checkin, null::text
          ),
          (
            v_last_week_start + 2, 'Held the imaginary studio review.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_checkin, 'planned_skip'::public.commitment_outcome, v_commitment_archive, null::text
          ),
          (
            v_last_week_start + 3, 'Trimmed the fictional archive backlog.',
            'Short on focused hours.', 'capacity'::public.blocker_type,
            v_commitment_archive, 'done'::public.commitment_outcome, v_commitment_chapter, null::text
          ),
          (
            v_last_week_start + 4, 'Reordered the imaginary chapter list.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'not_done'::public.commitment_outcome, v_commitment_chapter, null::text
          ),
          (
            v_week_start, 'Outlined the imaginary accessibility chapter.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'partial'::public.commitment_outcome, v_commitment_chapter,
            'The cardboard prototype survived the rain; keep that exact phrase.'::text
          ),
          (
            v_week_start + 1, 'Reworked the imaginary outline after board feedback.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'deferred'::public.commitment_outcome, v_commitment_checkin, null::text
          ),
          (
            v_week_start + 2, 'Protected the planned holiday block.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_checkin, 'planned_skip'::public.commitment_outcome, v_commitment_archive, null::text
          ),
          (
            v_week_start + 3, 'Relabeled a fictional archive shelf.',
            'Short on focused hours.', 'capacity'::public.blocker_type,
            v_commitment_archive, 'done'::public.commitment_outcome, v_commitment_chapter, null::text
          ),
          (
            v_week_start + 4, 'Drafted two imaginary field-guide spreads.',
            'Waiting on the fictional review board.', 'external_gate'::public.blocker_type,
            v_commitment_chapter, 'not_done'::public.commitment_outcome, v_commitment_next, null::text
          )
      ) as day(
        day_on, moved_text, blocker_text, blocker_type,
        previous_commitment_id, previous_outcome, next_commitment_id, buried_win
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
      v_day.previous_commitment_id, v_day.previous_outcome, v_day.next_commitment_id, v_day.buried_win
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
