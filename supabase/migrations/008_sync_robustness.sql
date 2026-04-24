-- 008_sync_robustness.sql
-- Three changes in support of robust multi-device sync:
--   (a) Server-authoritative created_at for ordering decisions.
--   (b) push_tickets ledger so a background job can reap Expo receipts and
--       prune DeviceNotRegistered tokens.
--   (c) Extend the webhook trigger to fire on UPDATE (when ended_at
--       transitions from NULL → non-NULL) so other devices can be told to
--       cancel their scheduled local notifications via silent push.

-- (a) Server-authoritative ordering column.
alter table public.fasting_sessions
  add column if not exists created_at timestamptz not null default now();

create index if not exists fasting_sessions_user_id_created_at_idx
  on public.fasting_sessions (user_id, created_at desc)
  where ended_at is null;

-- Make started_at default to now() so clients can omit it.
alter table public.fasting_sessions
  alter column started_at set default now();

-- (b) Push-ticket ledger. One row per Expo push ticket we send.
create table if not exists public.push_tickets (
  ticket_id  text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  device_id  text not null,
  sent_at    timestamptz not null default now()
);

create index if not exists push_tickets_sent_at_idx
  on public.push_tickets (sent_at);

alter table public.push_tickets enable row level security;
-- Only service role reads/writes push_tickets. No user-visible policies.

-- (c) Extend the webhook trigger. The existing trigger from migration 006
--     fires AFTER INSERT only. Add a second AFTER UPDATE trigger that only
--     fires on the specific transition "active → ended."
drop trigger if exists fasting_session_ended on public.fasting_sessions;
create trigger fasting_session_ended
  after update on public.fasting_sessions
  for each row
  when (old.ended_at is null and new.ended_at is not null)
  execute function public.notify_fast_event();
