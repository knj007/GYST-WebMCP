begin;

select plan(16);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'r'
      and relation.relname = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
  ),
  11::bigint,
  'all eleven Wave 2 application tables exist'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and relation.relrowsecurity
  ),
  11::bigint,
  'RLS is explicitly enabled on every application table'
);

select is(
  (
    select count(distinct table_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and column_name = 'user_id'
      and data_type = 'uuid'
      and is_nullable = 'NO'
  ),
  11::bigint,
  'every application table has a required UUID owner'
);

select is(
  (
    select count(distinct table_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and column_name = 'version'
      and data_type = 'bigint'
      and is_nullable = 'NO'
  ),
  11::bigint,
  'every application table has an optimistic version column'
);

select is(
  (
    select count(distinct table_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and column_name = 'created_at'
      and data_type = 'timestamp with time zone'
      and is_nullable = 'NO'
  ),
  11::bigint,
  'every application table has a required timestamptz creation time'
);

select is(
  (
    select count(distinct table_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and column_name = 'updated_at'
      and data_type = 'timestamp with time zone'
      and is_nullable = 'NO'
  ),
  11::bigint,
  'every application table has a required timestamptz update time'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_record
    join pg_class as relation on relation.oid = constraint_record.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and constraint_record.contype = 'u'
      and pg_get_constraintdef(constraint_record.oid) = 'UNIQUE (user_id, id)'
  ),
  11::bigint,
  'every application table exposes a composite ownership key'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_record
    join pg_class as relation on relation.oid = constraint_record.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'goals', 'key_dates', 'commitments', 'daily_entries', 'weekly_entries',
        'commitment_events', 'reminder_rules', 'notification_events'
      ])
      and constraint_record.contype = 'f'
      and cardinality(constraint_record.conkey) > 1
  ),
  13::bigint,
  'all thirteen application parent links include ownership in their foreign key'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_record
    join pg_class as relation on relation.oid = constraint_record.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and constraint_record.contype = 'f'
      and not exists (
        select 1
        from pg_index as index_record
        where index_record.indrelid = constraint_record.conrelid
          and index_record.indisvalid
          and not exists (
            select 1
            from generate_subscripts(constraint_record.conkey, 1) as position
            where index_record.indkey[position - 1]
              is distinct from constraint_record.conkey[position]
          )
      )
  ),
  0::bigint,
  'every application foreign key has a supporting index with the FK columns as its prefix'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
  ),
  38::bigint,
  'operation-specific policies cover the intended authenticated surface'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and cmd = 'ALL'
  ),
  0::bigint,
  'no broad FOR ALL policy hides operation intent'
);

select is(
  (
    select count(*)
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = any (array[
        'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
        'daily_entries', 'weekly_entries', 'commitment_events', 'reminder_rules',
        'notification_events'
      ])
      and grantee = 'anon'
  ),
  0::bigint,
  'anonymous receives no application table privileges'
);

select is(
  (
    select count(*)
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'commitment_events'
      and grantee = 'authenticated'
      and privilege_type in ('UPDATE', 'DELETE')
  ),
  0::bigint,
  'commitment events are append-only for authenticated users'
);

select is(
  (
    select array_agg(privilege_type::text order by privilege_type)::text[]
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'notification_events'
      and grantee = 'authenticated'
  ),
  array['SELECT']::text[],
  'notification delivery history is read-only for authenticated users'
);

select is(
  (
    select count(*)
    from pg_trigger
    where not tgisinternal
      and tgname = any (array[
        'commitment_events_guard_append_only',
        'ritual_sessions_guard_committed',
        'daily_entries_guard_committed',
        'weekly_entries_guard_committed'
      ])
  ),
  4::bigint,
  'committed ritual records and append-only events have trigger-level immutability guards'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'gyst_private'
      and procedure.prosecdef
  ),
  0::bigint,
  'no Wave 2 helper function uses SECURITY DEFINER'
);

select * from finish();

rollback;
