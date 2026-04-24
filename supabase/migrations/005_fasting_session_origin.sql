-- 005_fasting_session_origin.sql
-- Track which device was responsible for the last write to a session,
-- so the fan-out function can skip pushing back to the originator.

alter table public.fasting_sessions
  add column if not exists last_modified_by_device text;

create index if not exists fasting_sessions_user_id_active_idx
  on public.fasting_sessions (user_id, started_at desc)
  where ended_at is null;
