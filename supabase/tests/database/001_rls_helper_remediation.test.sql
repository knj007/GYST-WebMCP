begin;

select plan(3);

select is(
  (select count(*) from pg_event_trigger where evtname = 'ensure_rls'),
  0::bigint,
  'the untracked ensure_rls event trigger is absent'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null,
  'the untracked public.rls_auto_enable() function is absent'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'rls_auto_enable'
      and procedure.prosecdef
  ),
  0::bigint,
  'no public security-definer rls_auto_enable function remains'
);

select * from finish();

rollback;
