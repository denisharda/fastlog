-- 009_realtime_and_scheduled_pushes.sql
-- Introduces scheduled_pushes + fan-out trigger so that server, not each
-- device, owns phase/halfway/hydration/complete notification timing.
-- Also adds fasting_sessions + hydration_logs to the supabase_realtime
-- publication so foregrounded clients get instant row-change events.

-- 1. Table --------------------------------------------------------------
create table if not exists public.scheduled_pushes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  session_id  uuid not null references public.fasting_sessions(id) on delete cascade,
  kind        text not null,
  fire_at     timestamptz not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists scheduled_pushes_fire_at_idx
  on public.scheduled_pushes (fire_at);
create index if not exists scheduled_pushes_session_idx
  on public.scheduled_pushes (session_id);

alter table public.scheduled_pushes enable row level security;

-- Only service role writes/reads this table; no anon / authenticated
-- policies are added. Clients never touch it.

-- 2. Per-phase boundaries ------------------------------------------------
-- Kept in a helper so the trigger stays readable. Mirrors FASTING_PHASES
-- in constants/theme.ts — keep these in sync.
create or replace function public.fasting_phase_boundaries()
returns table(kind text, at_hours numeric, title text, body text)
language sql immutable as $$
  values
    ('phase_early_fasting',      4::numeric,  'Going strong!',          '4h in — insulin is dropping and your body is shifting gears. Keep it up!'),
    ('phase_fat_burning_begins', 8::numeric,  'You''re crushing it!',   '8h fasted — glycogen is depleting and fat burning is kicking in. Stay hydrated!'),
    ('phase_fat_burning_peak',   12::numeric, 'Halfway hero!',          '12h in — ketosis is starting. Your body is tapping into fat stores now.'),
    ('phase_autophagy',          16::numeric, 'Autophagy activated!',   '16h — your cells are cleaning house. This is where the magic happens.'),
    ('phase_deep_fast',          18::numeric, 'Deep fast territory!',   '18h+ — maximum autophagy and fat oxidation. You''re a fasting machine.');
$$;

-- 3. Trigger: on INSERT of a fasting session, pre-compute all pushes ---
create or replace function public.seed_scheduled_pushes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec   record;
  h     int;
  end_at timestamptz := new.started_at + (new.target_hours || ' hours')::interval;
begin
  -- Skip if this is a historical insert that's already fully in the past
  -- (unlikely but possible via manual backfill).
  if end_at <= now() then
    return new;
  end if;

  -- Phase notifications
  for rec in select * from public.fasting_phase_boundaries() loop
    if rec.at_hours < new.target_hours then
      insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
      values (
        new.user_id,
        new.id,
        rec.kind,
        new.started_at + (rec.at_hours || ' hours')::interval,
        jsonb_build_object('title', rec.title, 'body', rec.body, 'sessionId', new.id)
      );
    end if;
  end loop;

  -- Halfway
  insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
  values (
    new.user_id,
    new.id,
    'halfway',
    new.started_at + ((new.target_hours / 2.0) || ' hours')::interval,
    jsonb_build_object('title', 'Halfway there', 'body', 'You''re at the midpoint. Quiet progress — nice work.', 'sessionId', new.id)
  );

  -- Completion
  insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
  values (
    new.user_id,
    new.id,
    'complete',
    end_at,
    jsonb_build_object('title', 'Fast complete!', 'body', 'You did it! Time to break your fast mindfully.', 'sessionId', new.id)
  );

  -- Hydration reminders every 2h (cap 12 — matches MAX_WATER_REMINDERS in TS)
  h := 2;
  while h < new.target_hours and h <= 24 loop
    insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
    values (
      new.user_id,
      new.id,
      'hydration_reminder',
      new.started_at + (h || ' hours')::interval,
      jsonb_build_object('title', 'Stay Hydrated', 'body', 'You''re ' || h || ' hours into your fast. Remember to drink water!', 'sessionId', new.id)
    );
    h := h + 2;
  end loop;

  return new;
end;
$$;

drop trigger if exists fasting_session_seed_pushes on public.fasting_sessions;
create trigger fasting_session_seed_pushes
  after insert on public.fasting_sessions
  for each row execute function public.seed_scheduled_pushes();

-- 4. Trigger: on early end, clean up future pushes for that session ----
create or replace function public.reap_scheduled_pushes_on_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.ended_at is null and new.ended_at is not null then
    delete from public.scheduled_pushes
      where session_id = new.id
        and fire_at > now();
  end if;
  return new;
end;
$$;

drop trigger if exists fasting_session_reap_pushes on public.fasting_sessions;
create trigger fasting_session_reap_pushes
  after update on public.fasting_sessions
  for each row execute function public.reap_scheduled_pushes_on_end();

-- 5. pg_cron: invoke the dispatcher every minute -----------------------
create extension if not exists pg_cron with schema extensions;

-- Unschedule any prior invocation so this migration is idempotent.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'dispatch-scheduled-pushes';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end $$;

-- Schedule every minute — the dispatcher fetches rows with fire_at <= now().
-- Uses edge_url from Vault (seeded in migration 006).
select cron.schedule(
  'dispatch-scheduled-pushes',
  '* * * * *',
  $cron$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_url' limit 1) || '/dispatch-scheduled-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret' limit 1), '')
    ),
    body    := '{}'::jsonb
  );
  $cron$
);

-- 6. Realtime publication -----------------------------------------------
-- Make sure our tables are in supabase_realtime (they are, by default, in
-- managed SB) — this is idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fasting_sessions'
  ) then
    alter publication supabase_realtime add table public.fasting_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hydration_logs'
  ) then
    alter publication supabase_realtime add table public.hydration_logs;
  end if;
end $$;

-- Ensure REPLICA IDENTITY FULL so DELETE events include the row (we rely
-- on the id in the realtime delete handler).
alter table public.hydration_logs replica identity full;
alter table public.fasting_sessions replica identity full;
