-- Hydration tracking table
create table hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references fasting_sessions(id) on delete set null,
  amount_ml int not null check (amount_ml > 0),
  logged_at timestamptz default now()
);

-- Daily water goal on profiles
alter table profiles add column daily_water_goal_ml int default 2000;

-- RLS: users can only access their own hydration logs
alter table hydration_logs enable row level security;

create policy "Users can read own hydration logs"
  on hydration_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own hydration logs"
  on hydration_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own hydration logs"
  on hydration_logs for delete
  using (auth.uid() = user_id);

-- Index for efficient daily queries
create index idx_hydration_logs_user_date
  on hydration_logs (user_id, logged_at desc);
