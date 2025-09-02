
-- 1) Create activity_log table
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  username text not null,
  role text not null,
  action text not null,            -- e.g., 'login','logout','insert','update','delete','upsert','rates_save','expense_insert','sales_insert'
  table_name text,                 -- e.g., 'daily_rates','expense_log','sales_log','users'
  row_id uuid,                     -- id of the affected row when applicable
  description text,                -- human-readable description of the event
  metadata jsonb not null default '{}'::jsonb
);

-- 2) Enable RLS
alter table public.activity_log enable row level security;

-- 3) RLS policies (keep consistent with your current permissive setup)
-- Allow reading all logs (UI will still restrict to admin/owner)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_log'
      and policyname = 'Users can view all activity logs'
  ) then
    create policy "Users can view all activity logs"
      on public.activity_log
      for select
      using (true);
  end if;
end $$;

-- Allow inserts from the application
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_log'
      and policyname = 'Users can insert activity logs'
  ) then
    create policy "Users can insert activity logs"
      on public.activity_log
      for insert
      with check (true);
  end if;
end $$;

-- No update/delete policy (disallowed by default)

-- 4) Helpful indexes for filtering and reporting
create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
create index if not exists activity_log_username_idx on public.activity_log (username);
create index if not exists activity_log_table_name_idx on public.activity_log (table_name);
