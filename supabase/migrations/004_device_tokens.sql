-- 004_device_tokens.sql
-- One row per (user, install). Replaces the single profiles.push_token field
-- so server-side fan-out can reach every signed-in device.

create table if not exists public.device_tokens (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  device_id   text not null,
  push_token  text not null,
  platform    text not null check (platform in ('ios', 'android')),
  app_version text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists device_tokens_user_id_idx
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

create policy "Users can view their own device tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert their own device tokens"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own device tokens"
  on public.device_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own device tokens"
  on public.device_tokens for delete
  using (auth.uid() = user_id);

-- One-time backfill: existing single push_token values become a row in
-- device_tokens with a synthetic device_id. Subsequent app launches will
-- replace this with the real per-install device_id.
--
-- Guarded by a runtime column check so this migration also applies cleanly
-- to schemas where profiles.push_token was never added (or was dropped).
-- Uses EXECUTE so the SELECT is only parsed when the column actually exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'push_token'
  ) then
    execute $backfill$
      insert into public.device_tokens (user_id, device_id, push_token, platform)
      select id, 'legacy-backfill', push_token, 'ios'
      from public.profiles
      where push_token is not null
      on conflict (user_id, device_id) do nothing
    $backfill$;
  end if;
end $$;
