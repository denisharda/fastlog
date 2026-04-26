-- 013_auto_end_fasts.sql
-- Server-authoritative auto-end. At target time a pg_cron job writes
-- ended_at + completed = true so the existing notify-fast-event UPDATE
-- trigger fans out a single celebratory push, and Realtime tears down
-- LA/widget on every foreground device.
--
-- The legacy `complete`-kind scheduled push is removed: completion is
-- no longer a separately-scheduled event, it's a side effect of auto-end.

-- 1. Re-create seed_scheduled_pushes WITHOUT the 'complete' kind.
--    Everything else (phase transitions, halfway, hydration) is unchanged
--    from migration 010.
create or replace function public.seed_scheduled_pushes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec    record;
  h      int;
  end_at timestamptz := new.started_at + (new.target_hours || ' hours')::interval;
  prefs  jsonb;
begin
  if new.ended_at is not null then
    return new;
  end if;
  if end_at <= now() then
    return new;
  end if;

  select notification_prefs into prefs
    from public.profiles where id = new.user_id;
  prefs := coalesce(prefs, '{}'::jsonb);

  if coalesce((prefs->>'phaseTransitions')::boolean, true) then
    for rec in select * from public.fasting_phase_boundaries() loop
      if rec.at_hours < new.target_hours then
        insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
        values (
          new.user_id, new.id, rec.kind,
          new.started_at + (rec.at_hours || ' hours')::interval,
          jsonb_build_object('title', rec.title, 'body', rec.body, 'sessionId', new.id)
        );
      end if;
    end loop;
  end if;

  if coalesce((prefs->>'halfway')::boolean, true) then
    insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
    values (
      new.user_id, new.id, 'halfway',
      new.started_at + ((new.target_hours / 2.0) || ' hours')::interval,
      jsonb_build_object('title', 'Halfway there', 'body', 'You''re at the midpoint. Quiet progress — nice work.', 'sessionId', new.id)
    );
  end if;

  if coalesce((prefs->>'hydration')::boolean, true) then
    h := 2;
    while h < new.target_hours and h <= 24 loop
      insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
      values (
        new.user_id, new.id, 'hydration_reminder',
        new.started_at + (h || ' hours')::interval,
        jsonb_build_object('title', 'Stay Hydrated', 'body', 'You''re ' || h || ' hours into your fast. Remember to drink water!', 'sessionId', new.id)
      );
      h := h + 2;
    end loop;
  end if;

  return new;
end;
$$;

-- 2. Delete any existing future 'complete' rows so they don't fire after
--    auto-end ships. Past rows the dispatcher would have already deleted.
delete from public.scheduled_pushes
where kind = 'complete' and fire_at > now();

-- 3. auto_end_due_fasts: end every session whose target time has passed.
--    Stamp ended_at to the *exact* target moment (not now()) so duration
--    computations in the success drawer match what the user expected.
create or replace function public.auto_end_due_fasts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fasting_sessions
  set ended_at = started_at + (target_hours || ' hours')::interval,
      completed = true,
      last_modified_by_device = 'system:auto-end'
  where ended_at is null
    and now() >= started_at + (target_hours || ' hours')::interval;
end;
$$;

-- 4. Schedule the auto-end cron every minute. Idempotent.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'auto-end-due-fasts';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end $$;

select cron.schedule(
  'auto-end-due-fasts',
  '* * * * *',
  $cron$ select public.auto_end_due_fasts(); $cron$
);
