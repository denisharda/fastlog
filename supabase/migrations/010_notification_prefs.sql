-- 010_notification_prefs.sql
-- Move notification preferences into the DB so the scheduled_pushes
-- trigger can honor the user's toggle state. Before this, toggles lived
-- only in AsyncStorage on the starting device.

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default
    '{"phaseTransitions": true, "hydration": true, "halfway": true, "complete": true}'::jsonb;

-- Re-create seed_scheduled_pushes to read prefs + skip disabled kinds.
-- Also: skip entirely if the inserted row is already ended (manual backfill),
-- and keep the existing end_at-in-past guard.
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

  if coalesce((prefs->>'complete')::boolean, true) then
    insert into public.scheduled_pushes (user_id, session_id, kind, fire_at, payload)
    values (
      new.user_id, new.id, 'complete',
      end_at,
      jsonb_build_object('title', 'Fast complete!', 'body', 'You did it! Time to break your fast mindfully.', 'sessionId', new.id)
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

-- Re-create the pg_cron job to NO-OP when edge_url is missing (local dev).
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'dispatch-scheduled-pushes';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end $$;

select cron.schedule(
  'dispatch-scheduled-pushes',
  '* * * * *',
  $cron$
  do $body$
  declare
    url  text;
    sec  text;
  begin
    select decrypted_secret into url from vault.decrypted_secrets where name = 'edge_url' limit 1;
    if url is null or url = '' then
      return;
    end if;
    select decrypted_secret into sec from vault.decrypted_secrets where name = 'webhook_secret' limit 1;
    perform net.http_post(
      url     := url || '/dispatch-scheduled-pushes',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(sec, '')),
      body    := '{}'::jsonb
    );
  end;
  $body$;
  $cron$
);
