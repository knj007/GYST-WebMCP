-- Wave 2: establish the user-owned GYST ledger with explicit least-privilege RLS.
-- All externally visible identifiers are UUIDs. Every child relationship carries
-- user_id so a row cannot point at another user's parent, even if an application
-- query omits an ownership filter.

create type public.area_status as enum ('active', 'archived');
create type public.goal_status as enum ('active', 'paused', 'completed', 'archived');
create type public.key_date_kind as enum ('deadline', 'milestone', 'event', 'review');
create type public.commitment_state as enum ('active', 'completed', 'archived');
create type public.commitment_outcome as enum ('done', 'partial', 'deferred', 'not_done', 'planned_skip');
create type public.blocker_type as enum ('internal', 'external_gate', 'capacity', 'clarity', 'dependency', 'other');
create type public.ritual_kind as enum ('daily', 'weekly');
create type public.ritual_status as enum ('draft', 'committed');
create type public.weekly_arrow as enum ('up', 'steady', 'down');
create type public.commitment_event_kind as enum (
  'created',
  'reworded',
  'scored',
  'done',
  'partial',
  'deferred',
  'not_done',
  'planned_skip',
  'reopened'
);
create type public.reminder_cadence as enum ('once', 'daily', 'weekly');
create type public.notification_status as enum ('pending', 'claimed', 'sent', 'failed', 'cancelled');

create schema if not exists gyst_private;
revoke all on schema gyst_private from public, anon, authenticated;

create function gyst_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function gyst_private.mark_account_deletion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  marked_user_ids text := current_setting('gyst.account_deletion_user_ids', true);
begin
  perform set_config(
    'gyst.account_deletion_user_ids',
    concat_ws(',', nullif(marked_user_ids, ''), old.id::text),
    true
  );
  return old;
end;
$$;

create function gyst_private.preserve_stable_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
    raise exception 'stable id and ownership cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function gyst_private.guard_ritual_session_mutation()
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
    raise exception 'committed ritual sessions are immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function gyst_private.guard_ritual_entry_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_session_status public.ritual_status;
  target_session_status public.ritual_status;
begin
  if tg_op = 'DELETE'
    and pg_trigger_depth() > 1
    and old.user_id::text = any (
      string_to_array(coalesce(current_setting('gyst.account_deletion_user_ids', true), ''), ',')
    )
  then
    return old;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select session.status
      into source_session_status
      from public.ritual_sessions as session
     where session.user_id = old.user_id
       and session.id = old.ritual_session_id;

    if source_session_status = 'committed'::public.ritual_status then
      raise exception 'entries belonging to a committed ritual session are immutable' using errcode = '23514';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select session.status
      into target_session_status
      from public.ritual_sessions as session
     where session.user_id = new.user_id
       and session.id = new.ritual_session_id;

    if target_session_status = 'committed'::public.ritual_status then
      raise exception 'entries belonging to a committed ritual session are immutable' using errcode = '23514';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function gyst_private.guard_append_only_event()
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

  raise exception 'append-only ledger events cannot be changed' using errcode = '23514';
end;
$$;

revoke execute on function gyst_private.set_updated_at() from public, anon, authenticated;
revoke execute on function gyst_private.mark_account_deletion() from public, anon, authenticated;
revoke execute on function gyst_private.preserve_stable_identity() from public, anon, authenticated;
revoke execute on function gyst_private.guard_ritual_session_mutation() from public, anon, authenticated;
revoke execute on function gyst_private.guard_ritual_entry_mutation() from public, anon, authenticated;
revoke execute on function gyst_private.guard_append_only_event() from public, anon, authenticated;

-- Mark the transaction before Auth cascades begin. Immutable-ledger guards use
-- both this user-id marker and nested trigger depth, so ordinary or privileged
-- standalone deletes remain blocked while whole-account deletion can complete.
create trigger gyst_mark_account_deletion
before delete on auth.users
for each row execute function gyst_private.mark_account_deletion();

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  ritual_version text not null default 'gyst_v1',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id),
  constraint profiles_user_id_id_key unique (user_id, id),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 120),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 100),
  constraint profiles_ritual_version_check check (ritual_version = 'gyst_v1'),
  constraint profiles_version_check check (version > 0),
  constraint profiles_timestamps_check check (updated_at >= created_at)
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  status public.area_status not null default 'active',
  sort_order integer not null default 0,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_user_id_id_key unique (user_id, id),
  constraint areas_title_length check (char_length(title) between 1 and 160),
  constraint areas_description_length check (description is null or char_length(description) <= 4000),
  constraint areas_sort_order_check check (sort_order >= 0),
  constraint areas_version_check check (version > 0),
  constraint areas_timestamps_check check (updated_at >= created_at)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area_id uuid,
  title text not null,
  description text,
  status public.goal_status not null default 'active',
  target_date date,
  priority smallint not null default 3,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_user_id_id_key unique (user_id, id),
  constraint goals_area_fkey foreign key (user_id, area_id)
    references public.areas (user_id, id) on delete set null (area_id),
  constraint goals_title_length check (char_length(title) between 1 and 240),
  constraint goals_description_length check (description is null or char_length(description) <= 8000),
  constraint goals_priority_check check (priority between 1 and 5),
  constraint goals_version_check check (version > 0),
  constraint goals_timestamps_check check (updated_at >= created_at)
);

create table public.key_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area_id uuid,
  goal_id uuid,
  title text not null,
  kind public.key_date_kind not null default 'deadline',
  due_on date not null,
  notes text,
  completed_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint key_dates_user_id_id_key unique (user_id, id),
  constraint key_dates_area_fkey foreign key (user_id, area_id)
    references public.areas (user_id, id) on delete set null (area_id),
  constraint key_dates_goal_fkey foreign key (user_id, goal_id)
    references public.goals (user_id, id) on delete set null (goal_id),
  constraint key_dates_title_length check (char_length(title) between 1 and 240),
  constraint key_dates_notes_length check (notes is null or char_length(notes) <= 8000),
  constraint key_dates_version_check check (version > 0),
  constraint key_dates_timestamps_check check (updated_at >= created_at)
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid,
  title text not null,
  details text,
  state public.commitment_state not null default 'active',
  due_on date,
  completed_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commitments_user_id_id_key unique (user_id, id),
  constraint commitments_goal_fkey foreign key (user_id, goal_id)
    references public.goals (user_id, id) on delete set null (goal_id),
  constraint commitments_title_length check (char_length(title) between 1 and 500),
  constraint commitments_details_length check (details is null or char_length(details) <= 8000),
  constraint commitments_completion_check check (
    (state = 'active' and completed_at is null)
    or (state = 'completed' and completed_at is not null)
    or state = 'archived'
  ),
  constraint commitments_version_check check (version > 0),
  constraint commitments_timestamps_check check (updated_at >= created_at)
);

create table public.ritual_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.ritual_kind not null,
  period_start date not null,
  status public.ritual_status not null default 'draft',
  idempotency_key uuid not null default gen_random_uuid(),
  version bigint not null default 1,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ritual_sessions_user_id_id_key unique (user_id, id),
  constraint ritual_sessions_user_id_id_kind_key unique (user_id, id, kind),
  constraint ritual_sessions_user_period_key unique (user_id, kind, period_start),
  constraint ritual_sessions_user_idempotency_key unique (user_id, idempotency_key),
  constraint ritual_sessions_week_start_check check (kind <> 'weekly' or extract(isodow from period_start) = 1),
  constraint ritual_sessions_commit_check check (
    (status = 'draft' and committed_at is null)
    or (status = 'committed' and committed_at is not null)
  ),
  constraint ritual_sessions_version_check check (version > 0),
  constraint ritual_sessions_timestamps_check check (updated_at >= created_at)
);

create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ritual_session_id uuid not null,
  session_kind public.ritual_kind not null default 'daily',
  moved_text text,
  blocker_text text,
  blocker_type public.blocker_type,
  previous_commitment_id uuid,
  previous_commitment_outcome public.commitment_outcome,
  next_commitment_id uuid,
  optional_context text,
  buried_win text,
  is_sensitive boolean not null default false,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_entries_user_id_id_key unique (user_id, id),
  constraint daily_entries_session_key unique (user_id, ritual_session_id, session_kind),
  constraint daily_entries_session_kind_check check (session_kind = 'daily'),
  constraint daily_entries_session_fkey foreign key (user_id, ritual_session_id, session_kind)
    references public.ritual_sessions (user_id, id, kind) on delete cascade,
  constraint daily_entries_previous_commitment_fkey foreign key (user_id, previous_commitment_id)
    references public.commitments (user_id, id) on delete restrict,
  constraint daily_entries_next_commitment_fkey foreign key (user_id, next_commitment_id)
    references public.commitments (user_id, id) on delete restrict,
  constraint daily_entries_moved_length check (moved_text is null or char_length(moved_text) <= 12000),
  constraint daily_entries_blocker_length check (blocker_text is null or char_length(blocker_text) <= 8000),
  constraint daily_entries_blocker_pair_check check (
    (blocker_text is null and blocker_type is null)
    or (blocker_text is not null and blocker_type is not null)
  ),
  constraint daily_entries_previous_pair_check check (
    (previous_commitment_id is null and previous_commitment_outcome is null)
    or (previous_commitment_id is not null and previous_commitment_outcome is not null)
  ),
  constraint daily_entries_context_length check (optional_context is null or char_length(optional_context) <= 12000),
  constraint daily_entries_buried_win_length check (buried_win is null or char_length(buried_win) <= 4000),
  constraint daily_entries_version_check check (version > 0),
  constraint daily_entries_timestamps_check check (updated_at >= created_at)
);

create table public.weekly_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ritual_session_id uuid not null,
  session_kind public.ritual_kind not null default 'weekly',
  missing_metrics jsonb not null default '[]'::jsonb,
  observations jsonb not null default '[]'::jsonb,
  decision_text text,
  arrow public.weekly_arrow,
  priorities jsonb not null default '[]'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_entries_user_id_id_key unique (user_id, id),
  constraint weekly_entries_session_key unique (user_id, ritual_session_id, session_kind),
  constraint weekly_entries_session_kind_check check (session_kind = 'weekly'),
  constraint weekly_entries_session_fkey foreign key (user_id, ritual_session_id, session_kind)
    references public.ritual_sessions (user_id, id, kind) on delete cascade,
  constraint weekly_entries_missing_metrics_check check (jsonb_typeof(missing_metrics) = 'array'),
  constraint weekly_entries_observations_check check (jsonb_typeof(observations) = 'array'),
  constraint weekly_entries_priorities_check check (jsonb_typeof(priorities) = 'array'),
  constraint weekly_entries_decision_length check (decision_text is null or char_length(decision_text) <= 12000),
  constraint weekly_entries_version_check check (version > 0),
  constraint weekly_entries_timestamps_check check (updated_at >= created_at)
);

create table public.commitment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  commitment_id uuid not null,
  ritual_session_id uuid,
  kind public.commitment_event_kind not null,
  outcome public.commitment_outcome,
  title_snapshot text not null,
  details jsonb not null default '{}'::jsonb,
  event_on date not null,
  idempotency_key uuid not null default gen_random_uuid(),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commitment_events_user_id_id_key unique (user_id, id),
  constraint commitment_events_user_idempotency_key unique (user_id, idempotency_key),
  constraint commitment_events_commitment_fkey foreign key (user_id, commitment_id)
    references public.commitments (user_id, id) on delete restrict,
  constraint commitment_events_session_fkey foreign key (user_id, ritual_session_id)
    references public.ritual_sessions (user_id, id) on delete restrict,
  constraint commitment_events_title_length check (char_length(title_snapshot) between 1 and 500),
  constraint commitment_events_details_check check (jsonb_typeof(details) = 'object'),
  constraint commitment_events_outcome_check check (
    (kind = 'scored' and outcome is not null)
    or (kind in ('done', 'partial', 'deferred', 'not_done', 'planned_skip') and kind::text = outcome::text)
    or (kind not in ('scored', 'done', 'partial', 'deferred', 'not_done', 'planned_skip') and outcome is null)
  ),
  constraint commitment_events_version_check check (version = 1),
  constraint commitment_events_timestamps_check check (updated_at = created_at)
);

create table public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  commitment_id uuid,
  ritual_session_id uuid,
  ritual_kind public.ritual_kind,
  cadence public.reminder_cadence not null,
  local_time time not null,
  weekday smallint,
  timezone text not null,
  next_run_at timestamptz,
  enabled boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_rules_user_id_id_key unique (user_id, id),
  constraint reminder_rules_commitment_fkey foreign key (user_id, commitment_id)
    references public.commitments (user_id, id) on delete cascade,
  constraint reminder_rules_session_fkey foreign key (user_id, ritual_session_id, ritual_kind)
    references public.ritual_sessions (user_id, id, kind) on delete cascade,
  constraint reminder_rules_target_check check (num_nonnulls(commitment_id, ritual_kind) = 1),
  constraint reminder_rules_session_target_check check (ritual_session_id is null or ritual_kind is not null),
  constraint reminder_rules_weekday_check check (
    (cadence = 'weekly' and weekday between 1 and 7)
    or (cadence <> 'weekly' and weekday is null)
  ),
  constraint reminder_rules_timezone_length check (char_length(timezone) between 1 and 100),
  constraint reminder_rules_next_run_check check (not enabled or next_run_at is not null),
  constraint reminder_rules_version_check check (version > 0),
  constraint reminder_rules_timestamps_check check (updated_at >= created_at)
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_rule_id uuid not null,
  scheduled_for timestamptz not null,
  status public.notification_status not null default 'pending',
  attempt_count integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  provider_message_id text,
  error_code text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_events_user_id_id_key unique (user_id, id),
  constraint notification_events_rule_schedule_key unique (reminder_rule_id, scheduled_for),
  constraint notification_events_rule_fkey foreign key (user_id, reminder_rule_id)
    references public.reminder_rules (user_id, id) on delete restrict,
  constraint notification_events_attempt_count_check check (attempt_count >= 0),
  constraint notification_events_status_timestamps_check check (
    (status = 'pending' and claimed_at is null and sent_at is null and failed_at is null)
    or (status = 'claimed' and claimed_at is not null and sent_at is null and failed_at is null)
    or (status = 'sent' and claimed_at is not null and sent_at is not null and failed_at is null)
    or (status = 'failed' and claimed_at is not null and sent_at is null and failed_at is not null)
    or (status = 'cancelled' and sent_at is null)
  ),
  constraint notification_events_provider_id_length check (provider_message_id is null or char_length(provider_message_id) <= 500),
  constraint notification_events_error_code_length check (error_code is null or char_length(error_code) <= 500),
  constraint notification_events_version_check check (version > 0),
  constraint notification_events_timestamps_check check (updated_at >= created_at)
);

-- Foreign-key, RLS, and expected weekly/reminder query paths.
create index goals_user_area_idx on public.goals (user_id, area_id) where area_id is not null;
create index key_dates_user_area_idx on public.key_dates (user_id, area_id) where area_id is not null;
create index key_dates_user_goal_idx on public.key_dates (user_id, goal_id) where goal_id is not null;
create index key_dates_user_due_idx on public.key_dates (user_id, due_on) where completed_at is null;
create index commitments_user_goal_idx on public.commitments (user_id, goal_id) where goal_id is not null;
create index commitments_user_state_due_idx on public.commitments (user_id, state, due_on);
create index ritual_sessions_user_kind_period_idx on public.ritual_sessions (user_id, kind, period_start desc);
create index daily_entries_user_previous_commitment_idx on public.daily_entries (user_id, previous_commitment_id)
  where previous_commitment_id is not null;
create index daily_entries_user_next_commitment_idx on public.daily_entries (user_id, next_commitment_id)
  where next_commitment_id is not null;
create index commitment_events_user_commitment_event_idx
  on public.commitment_events (user_id, commitment_id, event_on desc);
create index commitment_events_user_session_idx on public.commitment_events (user_id, ritual_session_id)
  where ritual_session_id is not null;
create index commitment_events_user_kind_event_idx on public.commitment_events (user_id, kind, event_on desc);
create index reminder_rules_user_commitment_idx on public.reminder_rules (user_id, commitment_id)
  where commitment_id is not null;
create index reminder_rules_user_session_idx on public.reminder_rules (user_id, ritual_session_id, ritual_kind)
  where ritual_session_id is not null;
create index reminder_rules_due_idx on public.reminder_rules (next_run_at, id) where enabled;
create index notification_events_user_rule_idx on public.notification_events (user_id, reminder_rule_id);
create index notification_events_user_status_schedule_idx
  on public.notification_events (user_id, status, scheduled_for desc);
create index notification_events_claimable_idx
  on public.notification_events (scheduled_for, id) where status in ('pending', 'failed');

-- Keep timestamps current and identifiers stable on mutable tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'areas', 'goals', 'key_dates', 'commitments', 'ritual_sessions',
    'daily_entries', 'weekly_entries', 'reminder_rules', 'notification_events'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function gyst_private.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function gyst_private.preserve_stable_identity()',
      table_name || '_preserve_identity',
      table_name
    );
  end loop;
end;
$$;

create trigger ritual_sessions_guard_committed
before update or delete on public.ritual_sessions
for each row execute function gyst_private.guard_ritual_session_mutation();

create trigger daily_entries_guard_committed
before insert or update or delete on public.daily_entries
for each row execute function gyst_private.guard_ritual_entry_mutation();

create trigger weekly_entries_guard_committed
before insert or update or delete on public.weekly_entries
for each row execute function gyst_private.guard_ritual_entry_mutation();

create trigger commitment_events_guard_append_only
before update or delete on public.commitment_events
for each row execute function gyst_private.guard_append_only_event();

-- Explicit Data API surface. Anon receives no table privileges. Authenticated
-- receives only the operations needed by the ordinary application flow.
revoke all on table
  public.profiles,
  public.areas,
  public.goals,
  public.key_dates,
  public.commitments,
  public.ritual_sessions,
  public.daily_entries,
  public.weekly_entries,
  public.commitment_events,
  public.reminder_rules,
  public.notification_events
from public, anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table
  public.areas,
  public.goals,
  public.key_dates,
  public.commitments,
  public.ritual_sessions,
  public.daily_entries,
  public.weekly_entries,
  public.reminder_rules
to authenticated;
grant select, insert on table public.commitment_events to authenticated;
grant select on table public.notification_events to authenticated;

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.goals enable row level security;
alter table public.key_dates enable row level security;
alter table public.commitments enable row level security;
alter table public.ritual_sessions enable row level security;
alter table public.daily_entries enable row level security;
alter table public.weekly_entries enable row level security;
alter table public.commitment_events enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.notification_events enable row level security;

-- Standard owner-only CRUD policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['areas', 'goals', 'key_dates', 'commitments', 'reminder_rules']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select_own', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_update_own', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_delete_own', table_name
    );
  end loop;
end;
$$;

create policy profiles_select_own on public.profiles
for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy ritual_sessions_select_own on public.ritual_sessions
for select to authenticated using ((select auth.uid()) = user_id);
create policy ritual_sessions_insert_own on public.ritual_sessions
for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'draft' and committed_at is null);
create policy ritual_sessions_update_own_draft on public.ritual_sessions
for update to authenticated
using ((select auth.uid()) = user_id and status = 'draft')
with check (
  (select auth.uid()) = user_id
  and status = 'draft'
  and committed_at is null
);
create policy ritual_sessions_delete_own_draft on public.ritual_sessions
for delete to authenticated
using ((select auth.uid()) = user_id and status = 'draft');

create policy daily_entries_select_own on public.daily_entries
for select to authenticated using ((select auth.uid()) = user_id);
create policy daily_entries_insert_own_draft on public.daily_entries
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = daily_entries.user_id
      and session.id = daily_entries.ritual_session_id
      and session.status = 'draft'
  )
);
create policy daily_entries_update_own_draft on public.daily_entries
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = daily_entries.user_id
      and session.id = daily_entries.ritual_session_id
      and session.status = 'draft'
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = daily_entries.user_id
      and session.id = daily_entries.ritual_session_id
      and session.status = 'draft'
  )
);
create policy daily_entries_delete_own_draft on public.daily_entries
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = daily_entries.user_id
      and session.id = daily_entries.ritual_session_id
      and session.status = 'draft'
  )
);

create policy weekly_entries_select_own on public.weekly_entries
for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_entries_insert_own_draft on public.weekly_entries
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = weekly_entries.user_id
      and session.id = weekly_entries.ritual_session_id
      and session.status = 'draft'
  )
);
create policy weekly_entries_update_own_draft on public.weekly_entries
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = weekly_entries.user_id
      and session.id = weekly_entries.ritual_session_id
      and session.status = 'draft'
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = weekly_entries.user_id
      and session.id = weekly_entries.ritual_session_id
      and session.status = 'draft'
  )
);
create policy weekly_entries_delete_own_draft on public.weekly_entries
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ritual_sessions as session
    where session.user_id = weekly_entries.user_id
      and session.id = weekly_entries.ritual_session_id
      and session.status = 'draft'
  )
);

create policy commitment_events_select_own on public.commitment_events
for select to authenticated using ((select auth.uid()) = user_id);
create policy commitment_events_insert_own on public.commitment_events
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    ritual_session_id is null
    or exists (
      select 1 from public.ritual_sessions as session
      where session.user_id = commitment_events.user_id
        and session.id = commitment_events.ritual_session_id
        and session.status = 'draft'
    )
  )
);

create policy notification_events_select_own on public.notification_events
for select to authenticated using ((select auth.uid()) = user_id);
