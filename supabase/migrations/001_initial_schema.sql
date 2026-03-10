-- FastAI Initial Schema
-- Run this in the Supabase SQL editor or via `supabase db push`

-- ────────────────────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid references auth.users on delete cascade primary key,
  name            text,
  coach_personality text not null default 'motivational'
    check (coach_personality in ('motivational', 'calm', 'brutal')),
  preferred_protocol text not null default '16:8'
    check (preferred_protocol in ('16:8', '18:6', '24h', 'custom')),
  push_token      text,
  created_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- FASTING SESSIONS
-- ────────────────────────────────────────────────────────────
create table if not exists public.fasting_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  protocol        text not null
    check (protocol in ('16:8', '18:6', '24h', 'custom')),
  target_hours    int not null check (target_hours > 0),
  started_at      timestamptz not null,
  ended_at        timestamptz,
  completed       boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.fasting_sessions enable row level security;

create policy "Users can manage their own fasting sessions"
  on public.fasting_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index fasting_sessions_user_id_started_at_idx
  on public.fasting_sessions (user_id, started_at desc);

-- ────────────────────────────────────────────────────────────
-- AI CHECK-INS
-- ────────────────────────────────────────────────────────────
create table if not exists public.checkins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  session_id      uuid not null references public.fasting_sessions (id) on delete cascade,
  message         text not null,
  personality     text not null
    check (personality in ('motivational', 'calm', 'brutal')),
  fasting_hour    int not null check (fasting_hour >= 0),
  delivered_at    timestamptz not null default now()
);

alter table public.checkins enable row level security;

create policy "Users can view their own check-ins"
  on public.checkins for select
  using (auth.uid() = user_id);

-- Note: checkins are inserted by the Edge Function using service role key,
-- so no INSERT policy is needed for the client.

create index checkins_user_id_delivered_at_idx
  on public.checkins (user_id, delivered_at desc);

create index checkins_session_id_idx
  on public.checkins (session_id);
