-- 012_fasting_notes.sql
-- Per-session journal: stores the user's mood after completing a fast,
-- plus a metadata jsonb bag for future fields (energy, free-form note, etc.).
-- 1:1 with fasting_sessions enforced by unique(session_id) so the client
-- can upsert on conflict.

create table public.fasting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.fasting_sessions(id) on delete cascade,
  mood text check (mood in ('rough','meh','good','great','amazing')),
  metadata jsonb not null default '{}'::jsonb,
  last_modified_by_device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

create index idx_fasting_notes_user on public.fasting_notes (user_id);

-- updated_at trigger
create or replace function public.touch_fasting_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger fasting_notes_set_updated_at
  before update on public.fasting_notes
  for each row execute function public.touch_fasting_notes_updated_at();

-- RLS
alter table public.fasting_notes enable row level security;

create policy "read own notes"
  on public.fasting_notes for select
  using (auth.uid() = user_id);

create policy "insert own notes"
  on public.fasting_notes for insert
  with check (auth.uid() = user_id);

create policy "update own notes"
  on public.fasting_notes for update
  using (auth.uid() = user_id);

create policy "delete own notes"
  on public.fasting_notes for delete
  using (auth.uid() = user_id);

-- Realtime publication
alter publication supabase_realtime add table public.fasting_notes;
