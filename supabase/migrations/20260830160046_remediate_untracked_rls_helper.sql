-- Remove the unversioned hosted helper before application tables are introduced.
-- Explicit table-by-table RLS in later migrations replaces this DDL trigger.
drop event trigger if exists ensure_rls;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

drop function if exists public.rls_auto_enable();
