-- Wave 7: a permanent account can delete only its own Auth identity. The
-- existing auth.users deletion trigger marks this single transaction so every
-- owned ledger row cascades without making normal ledger deletion possible.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleting_user_id uuid := auth.uid();
begin
  if deleting_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'demo accounts cannot be deleted through this flow' using errcode = '42501';
  end if;

  delete from auth.users where id = deleting_user_id;

  if not found then
    raise exception 'account no longer exists' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
