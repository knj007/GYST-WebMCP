-- A missing version must be treated as a stale optimistic-concurrency token,
-- not as a SQL NULL comparison that falls through to a close.
create or replace function public.commit_daily_ritual(
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

  if p_expected_version is null or v_session.version <> p_expected_version then
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
