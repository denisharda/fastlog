-- 006_fast_event_webhook.sql
-- Calls the notify-fast-event Edge Function whenever a new fasting
-- session row appears.
--
-- Configuration: seed two entries in Supabase Vault BEFORE applying this
-- migration (managed Supabase blocks `alter database ... set`, so Vault
-- is the supported way to keep non-table config in Postgres):
--
--   select vault.create_secret(
--     'https://<project-ref>.functions.supabase.co',
--     'edge_url',
--     'Base URL for Supabase Edge Functions in this project'
--   );
--   select vault.create_secret(
--     '<a random 32+ char secret — also set WEBHOOK_SECRET in the Edge
--      Function environment via `supabase secrets set`>',
--     'webhook_secret',
--     'Shared secret between the DB trigger and notify-fast-event'
--   );
--
-- Re-seed with `update vault.secrets set secret = '...' where name = ...`
-- if the URL or secret ever change. If `edge_url` is missing the trigger
-- short-circuits — useful for local dev where the Edge Function isn't
-- deployed.

create extension if not exists pg_net   with schema extensions;
create extension if not exists supabase_vault;

create or replace function public.notify_fast_event() returns trigger
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  edge_url    text;
  edge_secret text;
begin
  select decrypted_secret into edge_url
    from vault.decrypted_secrets where name = 'edge_url' limit 1;
  select decrypted_secret into edge_secret
    from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

  if edge_url is null or edge_url = '' then
    return new;
  end if;

  -- pg_net publishes its functions in the `net` schema (not `extensions`),
  -- regardless of where the extension itself is installed.
  perform net.http_post(
    url     := edge_url || '/notify-fast-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(edge_secret, '')
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
