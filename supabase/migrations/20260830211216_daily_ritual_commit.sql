-- Wave 3: one narrow, authenticated transaction for the human daily close.
-- The function is SECURITY INVOKER: it keeps RLS in force while validating all
-- decision-bound fields, writing the stable score event, and closing the
-- session in one database transaction. A transaction-local marker permits the
-- final RLS-protected state transition only from this validated code path.

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
    or (
      status = 'committed'
      and committed_at is not null
      and kind = 'daily'::public.ritual_kind
      and (select current_setting('gyst.daily_commit_session_id', true)) = id::text
    )
  )
);

create function public.commit_daily_ritual(
  p_ritual_session_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
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
  v_entry public.daily_entries%rowtype;
  v_previous_commitment public.commitments%rowtype;
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

  -- A repeated click is safe after the first transaction commits. It returns
  -- the established result instead of creating a second ledger event.
  if v_session.status = 'committed'::public.ritual_status then
    return query select v_session.id, v_session.committed_at, v_session.version;
    return;
  end if;

  -- Lock only a draft row. A concurrent caller can commit while this call waits;
  -- in that case the update RLS policy hides the row, so re-read it normally
  -- and return the established committed result.
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

  select entry.*
    into v_entry
    from public.daily_entries as entry
   where entry.user_id = v_user_id
     and entry.ritual_session_id = v_session.id
   for update;

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
     and user_id = v_user_id
   for key share;

  if not found then
    raise exception 'previous commitment is not available to this account' using errcode = '23514';
  end if;

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
    v_user_id,
    v_previous_commitment.id,
    v_session.id,
    v_entry.previous_commitment_outcome::text::public.commitment_event_kind,
    v_entry.previous_commitment_outcome,
    v_previous_commitment.title,
    v_session.period_start,
    p_idempotency_key
  );

  perform set_config('gyst.daily_commit_session_id', v_session.id::text, true);

  update public.ritual_sessions as session
     set status = 'committed'::public.ritual_status,
         committed_at = now(),
         version = session.version + 1
   where session.id = v_session.id
     and session.user_id = v_user_id
  returning session.* into v_session;

  return query select v_session.id, v_session.committed_at, v_session.version;
end;
$$;

revoke all on function public.commit_daily_ritual(uuid, bigint, uuid) from public, anon;
grant execute on function public.commit_daily_ritual(uuid, bigint, uuid) to authenticated;
