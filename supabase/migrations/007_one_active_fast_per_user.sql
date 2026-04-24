-- 007_one_active_fast_per_user.sql
-- Enforce "at most one active fasting session per user" at the DB level.
-- Without this the client-side race between optimistic inserts on two
-- devices could leave both rows with ended_at IS NULL.

-- 1. Close any existing duplicate active sessions, keeping the most recent
--    one per user. Runs idempotently (once duplicates are gone, the CTE
--    returns no rows).
with ranked as (
  select id,
         row_number() over (partition by user_id order by started_at desc) as rn
  from public.fasting_sessions
  where ended_at is null
)
update public.fasting_sessions
set ended_at = now(),
    completed = false
where id in (select id from ranked where rn > 1);

-- 2. Partial unique index: only one row per user may have ended_at NULL.
--    The second device's optimistic insert will now fail with 23505, which
--    the client catches and converts into an adoption.
create unique index if not exists fasting_sessions_one_active_per_user
  on public.fasting_sessions (user_id)
  where ended_at is null;
