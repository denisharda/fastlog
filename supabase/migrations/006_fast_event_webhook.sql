-- 006_fast_event_webhook.sql
-- Calls the notify-fast-event Edge Function whenever a new fasting
-- session row appears.
--
-- Configuration: set the following database settings before applying:
--   alter database postgres set "app.settings.edge_url"
--     = 'https://<project-ref>.functions.supabase.co';
--   alter database postgres set "app.settings.edge_anon_key"
--     = '<your supabase anon key>';
--
-- These are read at trigger time. If edge_url is unset, the trigger
-- short-circuits — useful for local dev where the Edge Function isn't
-- deployed.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_fast_event() returns trigger
language plpgsql
security definer
as $$
declare
  edge_url text := current_setting('app.settings.edge_url', true);
  edge_key text := current_setting('app.settings.edge_anon_key', true);
begin
  if edge_url is null or edge_url = '' then
    return new;
  end if;

  perform extensions.http_post(
    url     := edge_url || '/notify-fast-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(edge_key, '')
    ),
    body    := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'record', row_to_json(new)
    )
  );

  return new;
end;
$$;

drop trigger if exists fasting_session_inserted on public.fasting_sessions;
create trigger fasting_session_inserted
  after insert on public.fasting_sessions
  for each row execute function public.notify_fast_event();
