begin;

select plan(132);

-- Identities:
--   A  onboards by hand, with no profile row beforehand
--   B  another owner; probes A's draft and the direct-update boundary
--   C  brand-new owner who onboards and closes a first daily ritual
--   D  backfill fixture that owns a commitment
--   E  backfill fixture that owns nothing
--   F  anonymous demo session
--   G  owner with a goal and no profile row (timezone fallback)
insert into auth.users (id, email)
values
  ('aa100000-0000-4000-8000-000000000001', 'onboard-a@example.test'),
  ('aa100000-0000-4000-8000-000000000002', 'onboard-b@example.test'),
  ('aa100000-0000-4000-8000-000000000003', 'onboard-c@example.test'),
  ('aa100000-0000-4000-8000-000000000004', 'onboard-d@example.test'),
  ('aa100000-0000-4000-8000-000000000005', 'onboard-e@example.test'),
  ('aa100000-0000-4000-8000-000000000006', null),
  ('aa100000-0000-4000-8000-000000000007', 'onboard-g@example.test');

insert into public.profiles (user_id, display_name, timezone)
values ('aa100000-0000-4000-8000-000000000002', 'Owner B', 'UTC');

insert into public.goals (id, user_id, title)
values ('a9100000-0000-4000-8000-000000000001', 'aa100000-0000-4000-8000-000000000007', 'Loose goal');

-- Schema contract -----------------------------------------------------------

select has_table('public', 'onboarding_drafts', 'the onboarding staging table exists');
select has_column('public', 'profiles', 'onboarded_at', 'profiles carry the onboarding gate column');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.onboarding_drafts'::regclass),
  'onboarding drafts enforce row-level security'
);
select is(
  (
    select count(*) from pg_constraint
     where conrelid = 'public.onboarding_drafts'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) in ('UNIQUE (user_id)', 'UNIQUE (user_id, id)')
  ),
  2::bigint,
  'one draft per owner, with the composite ownership key'
);
select is(
  (
    select count(*)
    from pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.onboarding_drafts'::regclass
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
  'every onboarding draft foreign key has a supporting index'
);
select ok(
  not has_table_privilege('anon', 'public.onboarding_drafts', 'select')
  and not has_table_privilege('anon', 'public.onboarding_drafts', 'insert')
  and not has_table_privilege('anon', 'public.onboarding_drafts', 'update')
  and not has_table_privilege('anon', 'public.onboarding_drafts', 'delete'),
  'anon holds no privilege on onboarding drafts'
);
select ok(
  has_table_privilege('authenticated', 'public.onboarding_drafts', 'select')
  and has_table_privilege('authenticated', 'public.onboarding_drafts', 'insert')
  and has_table_privilege('authenticated', 'public.onboarding_drafts', 'update')
  and not has_table_privilege('authenticated', 'public.onboarding_drafts', 'delete'),
  'authenticated may read, create, and update drafts but never delete one'
);
select is(
  (
    select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'onboarding_drafts' and cmd = 'DELETE'
  ),
  0::bigint,
  'no delete policy exists for onboarding drafts'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.save_onboarding_draft(jsonb, bigint)'::regprocedure),
  'onboarding draft save RPC uses invoker authority'
);
select ok(
  not has_function_privilege('anon', 'public.save_onboarding_draft(jsonb, bigint)', 'execute'),
  'anon cannot execute the onboarding draft save RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.save_onboarding_draft(jsonb, bigint)', 'execute'),
  'authenticated can execute the onboarding draft save RPC'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.commit_onboarding(uuid, bigint)'::regprocedure),
  'onboarding commit RPC uses invoker authority'
);
select ok(
  not has_function_privilege('anon', 'public.commit_onboarding(uuid, bigint)', 'execute'),
  'anon cannot execute the onboarding commit RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.commit_onboarding(uuid, bigint)', 'execute'),
  'authenticated can execute the onboarding commit RPC'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.add_commitment(uuid, text, text, date)'::regprocedure),
  'add_commitment uses invoker authority'
);
select ok(
  not has_function_privilege('anon', 'public.add_commitment(uuid, text, text, date)', 'execute'),
  'anon cannot execute add_commitment'
);
select ok(
  has_function_privilege('authenticated', 'public.add_commitment(uuid, text, text, date)', 'execute'),
  'authenticated can execute add_commitment'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.seed_demo_ledger()'::regprocedure),
  'the re-created demo seed still uses invoker authority'
);

-- Migration invariant: after the one-time backfill, no profile that owns a
-- committed ritual session or a commitment is left unmarked. This holds for
-- the local demo seed and for any fixture the earlier suites left behind.
select is(
  (
    select count(*) from public.profiles as profile
     where profile.onboarded_at is null
       and (
         exists (select 1 from public.commitments where user_id = profile.user_id)
         or exists (select 1 from public.ritual_sessions where user_id = profile.user_id and status = 'committed')
       )
  ),
  0::bigint,
  'the backfill left no working ledger unmarked'
);

-- Anonymous access ----------------------------------------------------------

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select 1 from public.onboarding_drafts limit 1$$,
  '42501', null::text,
  'anonymous cannot read onboarding drafts'
);
select throws_ok(
  $$select * from public.save_onboarding_draft('{}'::jsonb)$$,
  '42501', null::text,
  'anonymous cannot save an onboarding draft'
);
select throws_ok(
  $$select * from public.commit_onboarding('aa100000-0000-4000-8000-000000000001', 1)$$,
  '42501', null::text,
  'anonymous cannot commit onboarding'
);
select throws_ok(
  $$select * from public.add_commitment('a9100000-0000-4000-8000-000000000001', 'Anonymous promise')$$,
  '42501', null::text,
  'anonymous cannot add a commitment'
);

-- Owner A drafts ------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-4000-8000-000000000001', true);

select set_config(
  'gyst_test.draft_valid',
  $json${
    "display_name": "  Owner A  ",
    "timezone": "America/Chicago",
    "areas": [
      {"key": "work", "title": "Work", "description": "Studio work"},
      {"key": "home", "title": "Home", "description": null}
    ],
    "goals": [
      {"key": "guide", "area_key": "work", "title": "Ship the field guide", "description": "Because it matters", "target_date": "2026-12-01", "priority": 1},
      {"key": "archive", "area_key": "work", "title": "Sort the archive", "description": null, "target_date": null, "priority": 4},
      {"key": "garden", "area_key": "home", "title": "Plant the garden", "description": null, "target_date": "2027-03-15", "priority": 3}
    ],
    "key_dates": [
      {"goal_key": "guide", "title": "Guide review", "kind": "review", "due_on": "2026-10-01", "notes": "Board review"},
      {"goal_key": "garden", "title": "Last frost", "kind": "event", "due_on": "2027-04-15", "notes": null}
    ],
    "commitments": [
      {"goal_key": "guide", "title": "Draft chapter one", "details": "Two pages", "due_on": "2026-09-05"},
      {"goal_key": "archive", "title": "Label ten boxes", "details": null, "due_on": null},
      {"goal_key": "garden", "title": "Order seeds", "details": null, "due_on": null}
    ]
  }$json$,
  true
);

select set_config(
  'gyst_test.draft_a',
  (select onboarding_draft_id::text from public.save_onboarding_draft('{"areas": [{"key": "work", "title": "Work"}]}'::jsonb)),
  true
);
select is(
  (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  1::bigint,
  'the first draft save creates the row at version one'
);
select is(
  (select status::text from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'draft',
  'the first draft save leaves the row in draft'
);
select throws_ok(
  $$select * from public.save_onboarding_draft('{"areas": []}'::jsonb)$$,
  '40001', null::text,
  'an existing onboarding draft requires its expected version'
);
select throws_ok(
  $$select * from public.save_onboarding_draft('{"areas": []}'::jsonb, 0)$$,
  '40001', null::text,
  'a stale onboarding draft version is rejected'
);
select lives_ok(
  format($$select * from public.save_onboarding_draft(%L::jsonb, 1)$$, current_setting('gyst_test.draft_valid')::jsonb),
  'the current version saves the full draft'
);
select is(
  (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  2::bigint,
  'a successful draft save advances the version'
);
select lives_ok(
  format($$select * from public.save_onboarding_draft(%L::jsonb, 2)$$, current_setting('gyst_test.draft_valid')::jsonb),
  'a further draft save with the current version succeeds'
);
select is(
  (select draft from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  current_setting('gyst_test.draft_valid')::jsonb,
  'the draft payload is stored verbatim'
);
select is(
  (select status::text from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'draft',
  'repeated draft saves never commit'
);
select is(
  (select count(*) from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000001'),
  0::bigint,
  'draft saves create no profile row, so the owner is not onboarded'
);
select is(
  (
    select count(*) from (
      select user_id from public.areas
      union all select user_id from public.goals
      union all select user_id from public.key_dates
      union all select user_id from public.commitments
      union all select user_id from public.commitment_events
    ) as owned where owned.user_id = 'aa100000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'draft saves fan nothing out into the ledger'
);
select throws_ok(
  $$select * from public.save_onboarding_draft('{"areas": "not a list"}'::jsonb, 3)$$,
  '22023', null::text,
  'a draft whose collection is not an array is rejected at save'
);
select throws_ok(
  $$select * from public.save_onboarding_draft('{"timezone": 5}'::jsonb, 3)$$,
  '22023', null::text,
  'a draft whose text field is not text is rejected at save'
);
select throws_ok(
  $$select * from public.save_onboarding_draft('[]'::jsonb, 3)$$,
  '22023', null::text,
  'an onboarding draft payload must be a JSON object'
);
select throws_ok(
  $$select * from public.save_onboarding_draft(null::jsonb, 3)$$,
  '22023', null::text,
  'a null onboarding draft payload is rejected'
);

-- Owner B cannot reach A's draft ----------------------------------------------

select set_config('request.jwt.claim.sub', 'aa100000-0000-4000-8000-000000000002', true);

select is(
  (select count(*) from public.onboarding_drafts),
  0::bigint,
  'another owner cannot read the onboarding draft'
);
select throws_ok(
  $$insert into public.onboarding_drafts (user_id, draft)
    values ('aa100000-0000-4000-8000-000000000001', '{}'::jsonb)$$,
  '42501', null::text,
  'another owner cannot insert a draft as the owner'
);
select results_eq(
  $$update public.onboarding_drafts set version = version + 1
     where user_id = 'aa100000-0000-4000-8000-000000000001' returning 1$$,
  $$select 1 where false$$,
  'another owner cannot update the onboarding draft'
);
select throws_ok(
  format($$select * from public.commit_onboarding(%L, 3)$$, current_setting('gyst_test.draft_a')),
  '42501', null::text,
  'another owner cannot commit the onboarding draft'
);

-- The ledger boundary validates the draft -> committed transition itself, so
-- a direct update cannot skip the fan-out or mark an owner onboarded.
select lives_ok(
  $$insert into public.onboarding_drafts (user_id, draft)
    values ('aa100000-0000-4000-8000-000000000002', '{}'::jsonb)$$,
  'an owner may insert their own draft row directly'
);
select throws_ok(
  $$update public.onboarding_drafts set status = 'committed'
     where user_id = 'aa100000-0000-4000-8000-000000000002'$$,
  '22023', 'timezone is required',
  'a direct transition to committed still validates the draft at the ledger boundary'
);
select is(
  (select status::text from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000002'),
  'draft',
  'a rejected direct transition leaves the draft as a draft'
);
select is(
  (select onboarded_at from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000002'),
  null::timestamptz,
  'a rejected direct transition does not mark the owner onboarded'
);

-- Atomicity: every rejected commit leaves nothing behind ------------------------

select set_config('request.jwt.claim.sub', 'aa100000-0000-4000-8000-000000000001', true);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    jsonb_set(current_setting('gyst_test.draft_valid')::jsonb, '{commitments,0,goal_key}', '"missing"'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft with a dangling commitment goal key can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'commitment references an unknown goal key',
  'a commitment referencing a missing goal key is rejected'
);
select is(
  (
    select count(*) from (
      select user_id from public.areas
      union all select user_id from public.goals
      union all select user_id from public.key_dates
      union all select user_id from public.commitments
      union all select user_id from public.commitment_events
    ) as owned where owned.user_id = 'aa100000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'a rejected commit leaves zero areas, goals, key dates, commitments, and events'
);
select is(
  (select count(*) from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000001'),
  0::bigint,
  'a rejected commit creates no profile row and marks nothing onboarded'
);
select is(
  (select status::text from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'draft',
  'a rejected commit leaves the draft as a draft'
);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    jsonb_set(current_setting('gyst_test.draft_valid')::jsonb, '{goals,0,title}', to_jsonb(repeat('x', 241))),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft with an over-long goal title can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'goal title must be at most 240 characters',
  'an over-long title is rejected with a clear message before any constraint fires'
);
select is(
  (
    select count(*) from (
      select user_id from public.areas
      union all select user_id from public.goals
      union all select user_id from public.key_dates
      union all select user_id from public.commitments
      union all select user_id from public.commitment_events
    ) as owned where owned.user_id = 'aa100000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'the over-long title commit fans nothing out'
);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    jsonb_set(current_setting('gyst_test.draft_valid')::jsonb, '{commitments}', '[]'::jsonb),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft with no commitments can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'commitments must contain between 1 and 12 entries',
  'a draft that would produce no active commitment is refused'
);
select is(
  (
    select count(*) from (
      select user_id from public.areas
      union all select user_id from public.goals
      union all select user_id from public.key_dates
      union all select user_id from public.commitments
      union all select user_id from public.commitment_events
    ) as owned where owned.user_id = 'aa100000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'the zero-commitment refusal fans nothing out'
);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    jsonb_set(current_setting('gyst_test.draft_valid')::jsonb, '{timezone}', '"Mars/Olympus"'::jsonb),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft with an unknown timezone can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'timezone must be a valid IANA time zone name',
  'an unknown timezone is rejected at commit'
);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    current_setting('gyst_test.draft_valid')::jsonb - 'timezone',
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft without a timezone can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'timezone is required',
  'a draft without a timezone is rejected at commit'
);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    jsonb_set(current_setting('gyst_test.draft_valid')::jsonb, '{goals,1,area_key}', '"nowhere"'::jsonb),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft with a dangling goal area key can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'goal references an unknown area key',
  'a goal referencing a missing area key is rejected'
);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    jsonb_set(current_setting('gyst_test.draft_valid')::jsonb, '{goals,0,priority}', '9'::jsonb),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft with an out-of-range priority can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'goal priority must be a whole number from 1 to 5',
  'an out-of-range goal priority is rejected'
);

select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    jsonb_set(current_setting('gyst_test.draft_valid')::jsonb, '{key_dates,0,due_on}', '"next tuesday"'::jsonb),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'a draft with a malformed key date can be saved'
);
select throws_ok(
  format(
    $$select * from public.commit_onboarding(%L, %s)$$,
    current_setting('gyst_test.draft_a'),
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  '22023', 'key date due_on must be a YYYY-MM-DD date',
  'a malformed date is rejected'
);

-- Back to the valid draft; check the commit's own concurrency guard.
select lives_ok(
  format(
    $$select * from public.save_onboarding_draft(%L::jsonb, %s)$$,
    current_setting('gyst_test.draft_valid')::jsonb,
    (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')
  ),
  'the valid draft is restored'
);
select set_config(
  'gyst_test.version_a',
  (select version::text from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  true
);
select throws_ok(
  format($$select * from public.commit_onboarding(%L, null::bigint)$$, current_setting('gyst_test.draft_a')),
  '40001', null::text,
  'a missing expected version cannot commit onboarding'
);
select throws_ok(
  format($$select * from public.commit_onboarding(%L, %s)$$, current_setting('gyst_test.draft_a'), current_setting('gyst_test.version_a')::bigint - 1),
  '40001', null::text,
  'a stale expected version cannot commit onboarding'
);
select throws_ok(
  $$select * from public.commit_onboarding('aa100000-0000-4000-8000-00000000ffff', 1)$$,
  '42501', null::text,
  'an unknown draft id cannot commit onboarding'
);

-- The founding commit ----------------------------------------------------------

select set_config(
  'gyst_test.commit_a',
  (
    select row_to_json(result)::text
      from public.commit_onboarding(
        current_setting('gyst_test.draft_a')::uuid,
        current_setting('gyst_test.version_a')::bigint
      ) as result
  ),
  true
);

select is(
  (select count(*) from public.areas where user_id = 'aa100000-0000-4000-8000-000000000001'),
  2::bigint,
  'the founding commit creates every drafted area'
);
select is(
  (select array_agg(title order by sort_order) from public.areas where user_id = 'aa100000-0000-4000-8000-000000000001'),
  array['Work', 'Home'],
  'area sort order follows the draft array order'
);
select is(
  (select count(*) from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001'),
  3::bigint,
  'the founding commit creates every drafted goal'
);
select is(
  (select count(*) from public.key_dates where user_id = 'aa100000-0000-4000-8000-000000000001'),
  2::bigint,
  'the founding commit creates every drafted key date'
);
select is(
  (select count(*) from public.commitments where user_id = 'aa100000-0000-4000-8000-000000000001'),
  4::bigint,
  'the founding commit creates every drafted commitment plus the founding commitment'
);
select is(
  (select area_id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Ship the field guide'),
  (select id from public.areas where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Work'),
  'a goal resolves its area by key'
);
select is(
  (select area_id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Plant the garden'),
  (select id from public.areas where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Home'),
  'each goal resolves its own area'
);
select is(
  (
    select row(description, target_date, priority)::text
      from public.goals
     where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Ship the field guide'
  ),
  row('Because it matters', '2026-12-01'::date, 1::smallint)::text,
  'goal description, target date, and priority are mapped from the draft'
);
select ok(
  (
    select key_date.goal_id = goal.id and key_date.area_id = goal.area_id
      from public.key_dates as key_date
      join public.goals as goal on goal.user_id = key_date.user_id and goal.title = 'Ship the field guide'
     where key_date.user_id = 'aa100000-0000-4000-8000-000000000001' and key_date.title = 'Guide review'
  ),
  'a key date resolves its goal by key and inherits the goal area'
);
select is(
  (
    select row(kind::text, due_on, notes)::text
      from public.key_dates
     where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Guide review'
  ),
  row('review', '2026-10-01'::date, 'Board review')::text,
  'key date kind, due date, and notes are mapped from the draft'
);
select is(
  (select goal_id from public.commitments where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Order seeds'),
  (select id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Plant the garden'),
  'a commitment resolves its goal by key'
);
select is(
  (
    select row(details, due_on, state::text)::text
      from public.commitments
     where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Draft chapter one'
  ),
  row('Two pages', '2026-09-05'::date, 'active')::text,
  'commitment details and due date are mapped and the commitment is active'
);

select ok(
  (select onboarded_at is not null from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'the founding commit creates the profile and marks the owner onboarded'
);
select is(
  (select timezone from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'America/Chicago',
  'the founding commit writes the explicit timezone'
);
select is(
  (select display_name from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'Owner A',
  'the founding commit writes the trimmed display name'
);

select is(
  (
    select count(*) from public.commitments
     where user_id = 'aa100000-0000-4000-8000-000000000001'
       and title = 'Founded this GYST ledger'
  ),
  1::bigint,
  'exactly one founding commitment exists'
);
select ok(
  (
    select state = 'completed' and completed_at is not null and goal_id is null and due_on is null
      from public.commitments
     where user_id = 'aa100000-0000-4000-8000-000000000001'
       and title = 'Founded this GYST ledger'
  ),
  'the founding commitment is already kept, unattached to any goal'
);
select is(
  (
    select count(*) from public.commitment_events as event
     where event.user_id = 'aa100000-0000-4000-8000-000000000001'
       and event.kind = 'created'
       and event.ritual_session_id is null
       and event.title_snapshot = 'Founded this GYST ledger'
       and event.commitment_id = (
         select id from public.commitments
          where user_id = 'aa100000-0000-4000-8000-000000000001'
            and title = 'Founded this GYST ledger'
       )
  ),
  1::bigint,
  'the founding commitment has exactly one created event'
);
select is(
  (
    select event_on from public.commitment_events
     where user_id = 'aa100000-0000-4000-8000-000000000001'
       and title_snapshot = 'Founded this GYST ledger'
  ),
  (now() at time zone 'America/Chicago')::date,
  'created events are dated in the draft timezone'
);
select is(
  (
    select count(*) from public.commitments as commitment
     where commitment.user_id = 'aa100000-0000-4000-8000-000000000001'
       and (
         select count(*) from public.commitment_events as event
          where event.user_id = commitment.user_id
            and event.commitment_id = commitment.id
            and event.kind = 'created'
            and event.title_snapshot = commitment.title
       ) <> 1
  ),
  0::bigint,
  'every created commitment has exactly one created event carrying its title'
);
select is(
  (select count(*) from public.commitment_events where user_id = 'aa100000-0000-4000-8000-000000000001'),
  4::bigint,
  'the founding commit appends no other event'
);

select is(
  (select status::text from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'committed',
  'the draft row is committed'
);
select ok(
  (select committed_at is not null from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'the committed draft carries its commit timestamp'
);
select is(
  (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  current_setting('gyst_test.version_a')::bigint + 1,
  'the commit advances the draft version once'
);
select is(
  (select founding_commitment_id from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  (
    select id from public.commitments
     where user_id = 'aa100000-0000-4000-8000-000000000001'
       and title = 'Founded this GYST ledger'
  ),
  'the committed draft records its founding commitment'
);
select is(
  current_setting('gyst_test.commit_a')::jsonb ->> 'founding_commitment_id',
  (
    select id::text from public.commitments
     where user_id = 'aa100000-0000-4000-8000-000000000001'
       and title = 'Founded this GYST ledger'
  ),
  'the commit RPC returns the founding commitment id'
);
select is(
  (current_setting('gyst_test.commit_a')::jsonb ->> 'version')::bigint,
  (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  'the commit RPC returns the committed version'
);
select is(
  (
    select row_to_json(result)::text
      from public.commit_onboarding(current_setting('gyst_test.draft_a')::uuid, 1) as result
  ),
  current_setting('gyst_test.commit_a'),
  'a repeated commit is idempotent and returns the same values regardless of version'
);
select is(
  (select count(*) from public.commitments where user_id = 'aa100000-0000-4000-8000-000000000001'),
  4::bigint,
  'an idempotent replay creates no further rows'
);

-- Immutability of the founding statement.
select results_eq(
  $$update public.onboarding_drafts set draft = '{}'::jsonb
     where user_id = 'aa100000-0000-4000-8000-000000000001' returning 1$$,
  $$select 1 where false$$,
  'the owner cannot rewrite a committed onboarding draft'
);
select throws_ok(
  $$delete from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'the owner cannot delete an onboarding draft'
);
select throws_ok(
  format($$select * from public.save_onboarding_draft('{}'::jsonb, %s)$$, (select version from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001')),
  '23514', null::text,
  'a draft save after commit is refused'
);

reset role;
select throws_ok(
  $$update public.onboarding_drafts set version = version + 1
     where user_id = 'aa100000-0000-4000-8000-000000000001'$$,
  '23514', null::text,
  'trigger defense rejects privileged rewrites of a committed onboarding draft'
);
select throws_ok(
  $$delete from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'$$,
  '23514', null::text,
  'trigger defense rejects privileged standalone deletes of a committed onboarding draft'
);

-- Day one: a brand-new owner closes a first daily ritual ------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-4000-8000-000000000003', true);

select set_config(
  'gyst_test.draft_c',
  (
    select onboarding_draft_id::text from public.save_onboarding_draft(
      $json${
        "display_name": null,
        "timezone": "UTC",
        "areas": [{"key": "a", "title": "Only area", "description": null}],
        "goals": [{"key": "g", "area_key": "a", "title": "Only goal", "description": null, "target_date": null, "priority": 2}],
        "commitments": [{"goal_key": "g", "title": "First real promise", "details": null, "due_on": null}]
      }$json$::jsonb
    )
  ),
  true
);
select set_config(
  'gyst_test.commit_c',
  (
    select row_to_json(result)::text
      from public.commit_onboarding(current_setting('gyst_test.draft_c')::uuid, 1) as result
  ),
  true
);
select ok(
  (select onboarded_at is not null from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000003'),
  'a brand-new owner is onboarded with no seeded history'
);
select is(
  (select display_name from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000003'),
  null::text,
  'a null display name stays null'
);
select is(
  (select count(*) from public.key_dates where user_id = 'aa100000-0000-4000-8000-000000000003'),
  0::bigint,
  'key dates may be omitted from the draft'
);
select set_config(
  'gyst_test.session_c',
  (
    select row_to_json(result)::text
      from public.save_daily_ritual_draft(
        (now() at time zone 'UTC')::date,
        jsonb_build_object(
          'moved_text', 'Founded the ledger and chose the first promise',
          'blocker_text', null,
          'blocker_type', null,
          'previous_commitment_id', current_setting('gyst_test.commit_c')::jsonb ->> 'founding_commitment_id',
          'previous_commitment_outcome', 'done',
          'next_commitment_id', (
            select id from public.commitments
             where user_id = 'aa100000-0000-4000-8000-000000000003' and state = 'active'
          ),
          'optional_context', null,
          'buried_win', null,
          'is_sensitive', false
        )
      ) as result
  ),
  true
);
select lives_ok(
  format(
    $$select * from public.commit_daily_ritual(%L, %s)$$,
    current_setting('gyst_test.session_c')::jsonb ->> 'ritual_session_id',
    current_setting('gyst_test.session_c')::jsonb ->> 'version'
  ),
  'the first daily ritual commits on day one, scoring the founding commitment'
);
select is(
  (
    select status::text from public.ritual_sessions
     where id = (current_setting('gyst_test.session_c')::jsonb ->> 'ritual_session_id')::uuid
  ),
  'committed',
  'the day-one daily session is closed'
);
select is(
  (
    select count(*) from public.commitment_events
     where user_id = 'aa100000-0000-4000-8000-000000000003'
       and commitment_id = (current_setting('gyst_test.commit_c')::jsonb ->> 'founding_commitment_id')::uuid
       and kind = 'done'
       and outcome = 'done'
  ),
  1::bigint,
  'the day-one close appends the done event for the founding commitment'
);

-- add_commitment ---------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'aa100000-0000-4000-8000-000000000001', true);

select set_config(
  'gyst_test.added_a',
  (
    select commitment_id::text from public.add_commitment(
      (select id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Ship the field guide'),
      '  Write the intro  ',
      'One page',
      '2026-09-10'
    )
  ),
  true
);
select is(
  (
    select row(title, details, due_on, state::text)::text
      from public.commitments
     where id = current_setting('gyst_test.added_a')::uuid
       and user_id = 'aa100000-0000-4000-8000-000000000001'
       and goal_id = (select id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Ship the field guide')
  ),
  row('Write the intro', 'One page', '2026-09-10'::date, 'active')::text,
  'add_commitment inserts one active, trimmed commitment under the owned goal'
);
select is(
  (
    select count(*) from public.commitment_events
     where user_id = 'aa100000-0000-4000-8000-000000000001'
       and commitment_id = current_setting('gyst_test.added_a')::uuid
  ),
  1::bigint,
  'add_commitment appends exactly one event'
);
select is(
  (
    select row(kind::text, outcome::text, title_snapshot, ritual_session_id::text, event_on)::text
      from public.commitment_events
     where user_id = 'aa100000-0000-4000-8000-000000000001'
       and commitment_id = current_setting('gyst_test.added_a')::uuid
  ),
  row('created', null::text, 'Write the intro', null::text, (now() at time zone 'America/Chicago')::date)::text,
  'the created event carries the title and is dated in the profile timezone'
);
select throws_ok(
  format(
    $$select * from public.add_commitment(%L, %L)$$,
    (select id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Ship the field guide'),
    repeat('x', 501)
  ),
  '22023', null::text,
  'add_commitment refuses an over-long title'
);
select throws_ok(
  format(
    $$select * from public.add_commitment(%L, '   ')$$,
    (select id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Ship the field guide')
  ),
  '22023', null::text,
  'add_commitment refuses an empty title'
);
select throws_ok(
  $$select * from public.add_commitment(null::uuid, 'No goal')$$,
  '42501', null::text,
  'add_commitment refuses a missing goal'
);
select lives_ok(
  $$update public.goals set status = 'paused'
     where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Sort the archive'$$,
  'the owner can pause an owned goal'
);
select throws_ok(
  format(
    $$select * from public.add_commitment(%L, 'Promise under a paused goal')$$,
    (select id from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Sort the archive')
  ),
  '23514', null::text,
  'add_commitment refuses a goal that is not active'
);
select set_config(
  'gyst_test.goal_a_guide',
  (select id::text from public.goals where user_id = 'aa100000-0000-4000-8000-000000000001' and title = 'Ship the field guide'),
  true
);

select set_config('request.jwt.claim.sub', 'aa100000-0000-4000-8000-000000000002', true);
select throws_ok(
  format($$select * from public.add_commitment(%L, 'Promise under someone else''s goal')$$, current_setting('gyst_test.goal_a_guide')),
  '42501', null::text,
  'add_commitment refuses another owner''s goal without revealing it'
);
reset role;
select is(
  (select count(*) from public.commitments where user_id = 'aa100000-0000-4000-8000-000000000001'),
  5::bigint,
  'the refused cross-owner add creates nothing'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-4000-8000-000000000007', true);
select lives_ok(
  $$select * from public.add_commitment('a9100000-0000-4000-8000-000000000001', 'Promise without a profile')$$,
  'add_commitment works for an owner with no profile row'
);
select is(
  (
    select event_on from public.commitment_events
     where user_id = 'aa100000-0000-4000-8000-000000000007'
       and title_snapshot = 'Promise without a profile'
  ),
  (now() at time zone 'UTC')::date,
  'without a profile the created event falls back to UTC'
);

-- Backfill predicate -------------------------------------------------------------
--
-- Migrations run before pgTAP, so the one-time backfill cannot be observed on
-- fixtures created here. The migration invariant is asserted above; this
-- re-runs the identical statement against fresh fixtures to prove the predicate.

reset role;

insert into public.profiles (user_id)
values
  ('aa100000-0000-4000-8000-000000000004'),
  ('aa100000-0000-4000-8000-000000000005');

insert into public.commitments (user_id, title)
values ('aa100000-0000-4000-8000-000000000004', 'Existing promise');

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

select ok(
  (select onboarded_at is not null from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000004'),
  'the backfill marks an existing owner with a commitment as onboarded'
);
select is(
  (select onboarded_at from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000005'),
  null::timestamptz,
  'the backfill leaves an empty owner unmarked'
);
select is(
  (select onboarded_at from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000002'),
  null::timestamptz,
  'a draft alone does not count as a working ledger'
);

-- Demo sessions never meet the gate ---------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aa100000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":true}',
  true
);
select is(
  (select (public.seed_demo_ledger() ->> 'seeded')::boolean),
  true,
  'the re-created demo seed still seeds a demo session'
);
select ok(
  (select onboarded_at is not null from public.profiles where user_id = 'aa100000-0000-4000-8000-000000000006'),
  'the demo seed marks the demo profile onboarded'
);
select is(
  (select count(*) from public.commitments where user_id = 'aa100000-0000-4000-8000-000000000006'),
  4::bigint,
  'the demo persona is unchanged'
);

-- Whole-account deletion still cascades through the founding statement ------------

reset role;
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $$delete from auth.users where id = 'aa100000-0000-4000-8000-000000000001'$$,
  'whole-account deletion cascades through a committed onboarding draft'
);
select is(
  (select count(*) from public.onboarding_drafts where user_id = 'aa100000-0000-4000-8000-000000000001'),
  0::bigint,
  'the committed onboarding draft is removed with the account'
);
select is(
  (select count(*) from public.commitments where user_id = 'aa100000-0000-4000-8000-000000000001'),
  0::bigint,
  'the founding commitment is removed with the account'
);

select * from finish();

rollback;
