-- Wave 3: validate each daily close at the ledger boundary.
--
-- A human-only guarantee is an application/WebMCP capability boundary, not a
-- claim that Postgres can distinguish a browser click from equivalent
-- authenticated SQL. WebMCP receives no commit capability. This migration
-- instead ensures every owner-initiated daily close is complete, atomically
-- appends its stable outcome event, and becomes immutable.

drop policy ritual_sessions_update_own_draft on public.ritual_sessions;

create policy ritual_sessions_update_own_draft on public.ritual_sessions
for update to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'draft'
)
with check (
  (select auth.uid()) = user_id
  and (
    (status = 'draft' and committed_at is null)
    or (status = 'committed' and kind = 'daily'::public.ritual_kind)
  )
);

-- The application and WebMCP contracts do not expose direct event creation.
-- The existing authenticated owner grant remains because this SECURITY INVOKER
-- trigger must append the event under the same ordinary owner role.

create function gyst_private.guard_ritual_session_commit_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind
    or new.period_start is distinct from old.period_start
    or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'ritual kind, period, and idempotency key cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function gyst_private.complete_daily_ritual_commit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry public.daily_entries%rowtype;
  v_previous_commitment public.commitments%rowtype;
  v_next_commitment public.commitments%rowtype;
begin
  if old.status <> 'draft'::public.ritual_status
    or new.status <> 'committed'::public.ritual_status
    or new.kind <> 'daily'::public.ritual_kind then
    return new;
  end if;

  select entry.*
    into v_entry
    from public.daily_entries as entry
   where entry.user_id = new.user_id
     and entry.ritual_session_id = new.id
   for key share;

  if not found
    or nullif(btrim(v_entry.moved_text), '') is null
    or v_entry.previous_commitment_id is null
    or v_entry.previous_commitment_outcome is null
    or v_entry.next_commitment_id is null then
    raise exception 'complete what moved, score the previous commitment, and choose the next action before closing' using errcode = '23514';
  end if;

  select *
    into v_previous_commitment
    from public.commitments
   where id = v_entry.previous_commitment_id
     and user_id = new.user_id
   for key share;

  if not found then
    raise exception 'previous commitment is not available to this account' using errcode = '23514';
  end if;

  select *
    into v_next_commitment
    from public.commitments
   where id = v_entry.next_commitment_id
     and user_id = new.user_id
     and state = 'active'::public.commitment_state
   for key share;

  if not found then
    raise exception 'next commitment must be active and owned by this account' using errcode = '23514';
  end if;

  new.committed_at := now();

  insert into public.commitment_events (
    user_id,
    commitment_id,
    ritual_session_id,
    kind,
    outcome,
    title_snapshot,
    event_on,
    idempotency_key
  )
  values (
    new.user_id,
    v_previous_commitment.id,
    new.id,
    v_entry.previous_commitment_outcome::text::public.commitment_event_kind,
    v_entry.previous_commitment_outcome,
    v_previous_commitment.title,
    new.period_start,
    new.idempotency_key
  );

  return new;
end;
$$;

revoke execute on function gyst_private.guard_ritual_session_commit_identity() from public, anon, authenticated;
revoke execute on function gyst_private.complete_daily_ritual_commit() from public, anon, authenticated;

create trigger ritual_sessions_commit_identity
before update on public.ritual_sessions
for each row execute function gyst_private.guard_ritual_session_commit_identity();

create trigger ritual_sessions_complete_daily_commit
before update on public.ritual_sessions
for each row execute function gyst_private.complete_daily_ritual_commit();

drop function if exists public.commit_daily_ritual(uuid, bigint, uuid);

create function public.commit_daily_ritual(
  p_ritual_session_id uuid,
  p_expected_version bigint
)
returns table (
  ritual_session_id uuid,
  committed_at timestamptz,
  version bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ritual_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select *
    into v_session
    from public.ritual_sessions
   where id = p_ritual_session_id
     and user_id = v_user_id;

  if not found then
    raise exception 'daily ritual session was not found' using errcode = '42501';
  end if;

  if v_session.kind <> 'daily'::public.ritual_kind then
    raise exception 'only daily ritual sessions can use this commit path' using errcode = '23514';
  end if;

  if v_session.status = 'committed'::public.ritual_status then
    return query select v_session.id, v_session.committed_at, v_session.version;
    return;
  end if;

  select *
    into v_session
    from public.ritual_sessions
   where id = p_ritual_session_id
     and user_id = v_user_id
     and status = 'draft'::public.ritual_status
   for update;

  if not found then
    select *
      into v_session
      from public.ritual_sessions
     where id = p_ritual_session_id
       and user_id = v_user_id;

    if found and v_session.status = 'committed'::public.ritual_status then
      return query select v_session.id, v_session.committed_at, v_session.version;
      return;
    end if;

    raise exception 'daily ritual draft has changed; refresh before committing' using errcode = '40001';
  end if;

  if v_session.version <> p_expected_version then
    raise exception 'daily ritual draft has changed; refresh before committing' using errcode = '40001';
  end if;

  update public.ritual_sessions as session
     set status = 'committed'::public.ritual_status,
         version = session.version + 1
   where session.id = v_session.id
     and session.user_id = v_user_id
  returning session.* into v_session;

  return query select v_session.id, v_session.committed_at, v_session.version;
end;
$$;

revoke all on function public.commit_daily_ritual(uuid, bigint) from public, anon;
grant execute on function public.commit_daily_ritual(uuid, bigint) to authenticated;

create function public.save_daily_ritual_draft(
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
  v_entry public.daily_entries%rowtype;
  v_created_session boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception 'daily draft must be an object' using errcode = '22023';
  end if;

  select *
    into v_session
    from public.ritual_sessions
   where user_id = v_user_id
     and kind = 'daily'::public.ritual_kind
     and period_start = p_period_start
   for update;

  if not found then
    if p_expected_session_version is not null then
      raise exception 'daily ritual draft has changed; refresh before saving' using errcode = '40001';
    end if;

    insert into public.ritual_sessions (user_id, kind, period_start)
    values (v_user_id, 'daily'::public.ritual_kind, p_period_start)
    on conflict (user_id, kind, period_start) do nothing
    returning * into v_session;

    if not found then
      raise exception 'daily ritual draft has changed; refresh before saving' using errcode = '40001';
    end if;

    v_created_session := true;
  end if;

  if v_session.status <> 'draft'::public.ritual_status then
    raise exception 'today''s daily ritual is already committed' using errcode = '23514';
  end if;

  if not v_created_session
    and (p_expected_session_version is null or v_session.version <> p_expected_session_version) then
    raise exception 'daily ritual draft has changed; refresh before saving' using errcode = '40001';
  end if;

  select *
    into v_entry
    from public.daily_entries as entry
   where entry.user_id = v_user_id
     and entry.ritual_session_id = v_session.id
   for update;

  if found then
    update public.daily_entries as entry
       set moved_text = nullif(btrim(p_draft ->> 'moved_text'), ''),
           blocker_text = nullif(btrim(p_draft ->> 'blocker_text'), ''),
           blocker_type = nullif(p_draft ->> 'blocker_type', '')::public.blocker_type,
           previous_commitment_id = nullif(p_draft ->> 'previous_commitment_id', '')::uuid,
           previous_commitment_outcome = nullif(p_draft ->> 'previous_commitment_outcome', '')::public.commitment_outcome,
           next_commitment_id = nullif(p_draft ->> 'next_commitment_id', '')::uuid,
           optional_context = nullif(btrim(p_draft ->> 'optional_context'), ''),
           buried_win = nullif(btrim(p_draft ->> 'buried_win'), ''),
           is_sensitive = coalesce((p_draft ->> 'is_sensitive')::boolean, false),
           version = entry.version + 1
     where entry.id = v_entry.id
       and entry.user_id = v_user_id;
  else
    insert into public.daily_entries (
      user_id,
      ritual_session_id,
      moved_text,
      blocker_text,
      blocker_type,
      previous_commitment_id,
      previous_commitment_outcome,
      next_commitment_id,
      optional_context,
      buried_win,
      is_sensitive
    )
    values (
      v_user_id,
      v_session.id,
      nullif(btrim(p_draft ->> 'moved_text'), ''),
      nullif(btrim(p_draft ->> 'blocker_text'), ''),
      nullif(p_draft ->> 'blocker_type', '')::public.blocker_type,
      nullif(p_draft ->> 'previous_commitment_id', '')::uuid,
      nullif(p_draft ->> 'previous_commitment_outcome', '')::public.commitment_outcome,
      nullif(p_draft ->> 'next_commitment_id', '')::uuid,
      nullif(btrim(p_draft ->> 'optional_context'), ''),
      nullif(btrim(p_draft ->> 'buried_win'), ''),
      coalesce((p_draft ->> 'is_sensitive')::boolean, false)
    );
  end if;

  if not v_created_session then
    update public.ritual_sessions as session
       set version = session.version + 1
     where session.id = v_session.id
       and session.user_id = v_user_id
    returning session.* into v_session;
  end if;

  return query select v_session.id, v_session.status, v_session.version;
end;
$$;

revoke all on function public.save_daily_ritual_draft(date, jsonb, bigint) from public, anon;
grant execute on function public.save_daily_ritual_draft(date, jsonb, bigint) to authenticated;
