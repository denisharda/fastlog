# Realtime + Server-Scheduled Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make multi-device sync instant when foregrounded (Realtime) and make every connected device receive the same notifications (server-scheduled pushes) — regardless of which device started the fast.

**Architecture:** Supabase Realtime is the primary transport for foreground sync; both fasting and hydration writes broadcast through it. A new `scheduled_pushes` table + `pg_cron` worker fires visible push notifications at each phase boundary / water reminder / halfway / complete to **all** of a user's registered devices — replacing the per-device local scheduling we do today. The existing silent-push + `expo-task-manager` background path is removed in favor of visible pushes + fetch-on-open reconciliation.

**Tech Stack:** Supabase Realtime (postgres_changes channel), pg_cron, Supabase Edge Functions (Deno), Expo Push API, expo-notifications (local receipt only), Zustand, React Query.

---

## Architecture Notes

### Notification ownership shift
**Before:** Device that starts a fast schedules phase/halfway/hydration/complete locally via `expo-notifications`. Other devices get nothing until opened.
**After:** All scheduling rows live in `scheduled_pushes`. A 1-min `pg_cron` job picks up due rows and fans out visible pushes via the Expo API to **every** `device_tokens` row for the user. The device that originated the fast does NOT schedule any local phase/halfway/hydration/complete notifications — server is the single source of truth.

**Kept local:** the fast-schedule reminder (the "time to start your fast" recurring notification from `fastScheduler.ts`) — that's a per-device preference, not a cross-device event.

### Realtime ownership
**Before:** `syncWithRemote()` runs on mount + AppState=active + stopFast callbacks.
**After:** In addition to the above, a WebSocket subscription to `fasting_sessions` + `hydration_logs` (filtered by `user_id`) dispatches the same handlers instantly while the app is foregrounded. Subscription starts/stops with AppState to save battery. `syncWithRemote()` stays as the reconnect/catchup path.

### Silent push removal
`notify-fast-event` currently emits a silent `_contentAvailable: true` payload on end events for the background task manager to handle. We remove the silent branch — both start and end become simple visible pushes. The background task manager, `expo-task-manager` dependency, and `lib/backgroundNotifications.ts` are deleted.

### What Realtime CAN'T do (addressed by pushes)
- Wake a backgrounded iOS app — hence server-scheduled pushes for timing-sensitive notifications.
- Deliver events if the app is killed — foreground reconcile on next open handles the catchup.

### Kind enum for `scheduled_pushes.kind`
- `phase_early_fasting` (4h)
- `phase_fat_burning_begins` (8h)
- `phase_fat_burning_peak` (12h)
- `phase_autophagy` (16h)
- `phase_deep_fast` (18h)
- `halfway`
- `hydration_reminder` (every 2h, capped at 12 rows)
- `complete` (at target end time)

These are produced at fast start, pre-computed with the absolute `fire_at` timestamp. On early end, we delete all non-fired rows for that session. On fast INSERT the DB trigger fans these out into `scheduled_pushes` in a single statement.

---

## File Structure

**Create:**
- `supabase/migrations/009_realtime_and_scheduled_pushes.sql` — `scheduled_pushes` table, schedule-generator trigger on `fasting_sessions` INSERT, cleanup trigger on fasting_sessions UPDATE(ended_at), `pg_cron` schedule, publication additions for Realtime
- `supabase/functions/dispatch-scheduled-pushes/index.ts` — picks due rows, fans out via Expo, deletes processed rows
- `supabase/functions/dispatch-scheduled-pushes/index_test.ts` — Deno tests
- `lib/realtime.ts` — WebSocket subscription helpers (start/stop, handlers)
- `lib/hydrationSync.ts` — pure helpers to merge remote `hydration_logs` events into local store

**Modify:**
- `supabase/functions/notify-fast-event/index.ts` — drop silent-push branch on end events; both kinds become visible
- `supabase/functions/notify-fast-event/index_test.ts` — update assertions
- `lib/sessionAdoption.ts` — remove `schedulePhaseNotifications`, `scheduleHalfwayNotification`, `scheduleWaterReminders`, `scheduleCompletionNotification` calls
- `lib/notifications.ts` — delete the four exported functions listed above (they're now dead code)
- `app/_layout.tsx` — start/stop Realtime subscription with AppState; remove `registerBackgroundNotificationTask` import + effect
- `stores/hydrationStore.ts` — add `applyRemoteLog` and `removeLogById` actions used by Realtime handlers
- `package.json` — remove `expo-task-manager` dependency

**Delete:**
- `lib/backgroundNotifications.ts`

---

## Task 1: Migration 009 — scheduled_pushes table + scheduler trigger

**Files:**
- Create: `supabase/migrations/009_realtime_and_scheduled_pushes.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Apply the migration against the dev DB**

Run: `supabase migration up`
Expected: migration 009 applied, no errors. Verify with `select jobname from cron.job;` → includes `dispatch-scheduled-pushes`.

- [ ] **Step 3: Smoke test the trigger**

Run (in Supabase SQL editor):
```sql
insert into fasting_sessions (user_id, protocol, target_hours, started_at)
select id, '16:8', 16, now() from profiles limit 1
returning id;
-- then:
select kind, fire_at from scheduled_pushes where session_id = '<id from above>' order by fire_at;
```
Expected: 5 phase rows (4/8/12/16 — 18h filtered because 18 ≥ 16) + halfway + complete + 7 hydration rows (2,4,…,14). Early fasting phase at +4h, complete at +16h.

Actually — phase_early_fasting=4h, fat_burning_begins=8h, fat_burning_peak=12h — `phase_autophagy=16` is NOT `< 16` so only 3 phase rows for a 16h fast. Re-verify count: `select count(*), kind from scheduled_pushes where session_id = ... group by kind`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_realtime_and_scheduled_pushes.sql
git commit -m "feat(db): add scheduled_pushes + per-fast seeding triggers"
```

---

## Task 2: Edge Function — dispatch-scheduled-pushes

**Files:**
- Create: `supabase/functions/dispatch-scheduled-pushes/index.ts`
- Create: `supabase/functions/dispatch-scheduled-pushes/index_test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// supabase/functions/dispatch-scheduled-pushes/index_test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildMessagesForRow } from './index.ts';

Deno.test('buildMessagesForRow builds one message per device token', () => {
  const tokens = [
    { push_token: 'ExpoPushToken[a]', device_id: 'd1' },
    { push_token: 'ExpoPushToken[b]', device_id: 'd2' },
  ];
  const row = {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: 'u1',
    session_id: 's1',
    kind: 'halfway',
    fire_at: new Date().toISOString(),
    payload: { title: 'Halfway there', body: 'You\'re at the midpoint.', sessionId: 's1' },
  };
  const msgs = buildMessagesForRow(row, tokens);
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0].title, 'Halfway there');
  assertEquals(msgs[0].body, 'You\'re at the midpoint.');
  assertEquals(msgs[0].sound, 'default');
  assertEquals(msgs[0].data.kind, 'halfway');
  assertEquals(msgs[0].data.sessionId, 's1');
});

Deno.test('buildMessagesForRow returns empty when no tokens', () => {
  const row = {
    id: '1', user_id: 'u1', session_id: 's1',
    kind: 'complete', fire_at: new Date().toISOString(),
    payload: { title: 'x', body: 'y', sessionId: 's1' },
  };
  assertEquals(buildMessagesForRow(row, []).length, 0);
});
```

- [ ] **Step 2: Verify test fails**

Run: `cd supabase/functions/dispatch-scheduled-pushes && deno test --allow-net --allow-env`
Expected: FAIL with "module not found" for `./index.ts`.

- [ ] **Step 3: Implement the function**

```typescript
// supabase/functions/dispatch-scheduled-pushes/index.ts
import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ScheduledRow {
  id: string;
  user_id: string;
  session_id: string;
  kind: string;
  fire_at: string;
  payload: { title: string; body: string; sessionId: string };
}

export interface DeviceToken {
  push_token: string;
  device_id: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  data: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
const BATCH_LIMIT = 200;

export function buildMessagesForRow(
  row: ScheduledRow,
  tokens: DeviceToken[],
): ExpoMessage[] {
  return tokens.map((t) => ({
    to: t.push_token,
    title: row.payload.title,
    body: row.payload.body,
    sound: 'default',
    priority: 'high',
    data: { kind: row.kind, sessionId: row.payload.sessionId },
  }));
}

async function sendToExpo(messages: ExpoMessage[]) {
  if (messages.length === 0) return [];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    console.error('[dispatch-scheduled-pushes] expo failed', res.status, await res.text());
    return [];
  }
  const j = await res.json();
  return Array.isArray(j?.data) ? j.data : [];
}

export async function handleRequest(req: Request): Promise<Response> {
  const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!expectedSecret) {
    return new Response(JSON.stringify({ error: 'server not configured' }), { status: 500 });
  }
  if (req.headers.get('x-webhook-secret') !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Grab a batch of due rows. Use `select ... for update skip locked` via
  // an RPC would be ideal, but for a per-minute cron with single worker,
  // a simple fetch + delete is fine and idempotent-enough.
  const { data: due, error } = await supabase
    .from('scheduled_pushes')
    .select('*')
    .lte('fire_at', new Date().toISOString())
    .order('fire_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('[dispatch-scheduled-pushes] fetch failed', error);
    return new Response(JSON.stringify({ error: 'fetch failed' }), { status: 500 });
  }
  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Group rows by user to minimize token lookups.
  const byUser = new Map<string, ScheduledRow[]>();
  for (const r of due as ScheduledRow[]) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(r);
    byUser.set(r.user_id, arr);
  }

  let totalSent = 0;
  const processedIds: string[] = [];

  for (const [userId, rows] of byUser) {
    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('push_token, device_id')
      .eq('user_id', userId);
    const tokenList = (tokens ?? []) as DeviceToken[];

    for (const row of rows) {
      const messages = buildMessagesForRow(row, tokenList);
      if (messages.length > 0) {
        await sendToExpo(messages);
        totalSent += messages.length;
      }
      processedIds.push(row.id);
    }
  }

  if (processedIds.length > 0) {
    const { error: delErr } = await supabase
      .from('scheduled_pushes')
      .delete()
      .in('id', processedIds);
    if (delErr) console.error('[dispatch-scheduled-pushes] delete failed', delErr);
  }

  return new Response(
    JSON.stringify({ sent: totalSent, processed: processedIds.length }),
    { status: 200 },
  );
}

if (import.meta.main) {
  serve(handleRequest);
}
```

- [ ] **Step 4: Re-run tests, verify they pass**

Run: `cd supabase/functions/dispatch-scheduled-pushes && deno test --allow-net --allow-env`
Expected: PASS both tests.

- [ ] **Step 5: Deploy and schedule test run**

Run: `supabase functions deploy dispatch-scheduled-pushes --no-verify-jwt`
Expected: deployed successfully. Verify with `supabase functions list`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/dispatch-scheduled-pushes/
git commit -m "feat(edge): dispatch-scheduled-pushes fans out due scheduled pushes"
```

---

## Task 3: Simplify notify-fast-event — end is now a visible push

**Files:**
- Modify: `supabase/functions/notify-fast-event/index.ts`
- Modify: `supabase/functions/notify-fast-event/index_test.ts`

- [ ] **Step 1: Update the end-kind branch in `buildExpoMessages`**

In `supabase/functions/notify-fast-event/index.ts`, replace the `if (args.kind === 'end')` branch:

```typescript
  if (args.kind === 'end') {
    return recipients.map((t) => ({
      to: t.push_token,
      title: 'Fast ended',
      body: `Your ${args.protocol} fast ended on another device.`,
      sound: 'default',
      priority: 'high',
      data: { kind: 'fast_ended', sessionId: args.sessionId },
    }));
  }
```

(Remove `_contentAvailable: true` and `sound: null` — this is now a plain visible push.)

- [ ] **Step 2: Update the end-kind test**

Find the existing test in `index_test.ts` asserting on the end payload and update the expectation:

```typescript
Deno.test('buildExpoMessages: end is a visible push', () => {
  const tokens = [{ device_id: 'd1', push_token: 'tok1' }];
  const msgs = buildExpoMessages(tokens, {
    originDeviceId: null,
    protocol: '16:8',
    sessionId: 's1',
    kind: 'end',
  });
  assertEquals(msgs.length, 1);
  assertEquals(msgs[0].title, 'Fast ended');
  assertEquals(msgs[0].sound, 'default');
  assertEquals(msgs[0].data.kind, 'fast_ended');
  // No _contentAvailable — this is not a silent push anymore.
  assertEquals((msgs[0] as Record<string, unknown>)._contentAvailable, undefined);
});
```

Remove any pre-existing test that asserted `_contentAvailable: true` or `sound: null` for the end branch.

- [ ] **Step 3: Run tests, verify they pass**

Run: `cd supabase/functions/notify-fast-event && deno test --allow-net --allow-env`
Expected: PASS.

- [ ] **Step 4: Deploy**

Run: `supabase functions deploy notify-fast-event --no-verify-jwt`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-fast-event/
git commit -m "refactor(edge): end-of-fast push is visible (drop silent payload)"
```

---

## Task 4: Hydration store — add apply/remove helpers

**Files:**
- Modify: `stores/hydrationStore.ts`

- [ ] **Step 1: Add the two new actions**

In `stores/hydrationStore.ts`, add to the `HydrationState` interface:

```typescript
interface HydrationState {
  todayLogs: LocalHydrationLog[];
  dailyGoalMl: number;
  lastResetDate: string;
  logWater: (log: LocalHydrationLog) => void;
  removeLog: (logId: string) => void;
  setDailyGoal: (goalMl: number) => void;
  resetIfNewDay: () => void;
  applyRemoteLog: (log: LocalHydrationLog) => void;
  removeLogById: (logId: string) => void;
}
```

And add the implementations inside the store definition:

```typescript
      applyRemoteLog: (log) => {
        get().resetIfNewDay();
        set((state) => {
          if (state.todayLogs.some((l) => l.id === log.id)) return state;
          const loggedToday = log.logged_at.slice(0, 10) === getTodayDate();
          if (!loggedToday) return state;
          return { todayLogs: [...state.todayLogs, log] };
        });
      },

      removeLogById: (logId) =>
        set((state) => ({
          todayLogs: state.todayLogs.filter((l) => l.id !== logId),
        })),
```

The `applyRemoteLog` dedup guard is critical — the originator device will also receive its own INSERT via Realtime echo and must not double-count.

- [ ] **Step 2: Commit**

```bash
git add stores/hydrationStore.ts
git commit -m "feat(store): add applyRemoteLog + removeLogById for realtime merges"
```

---

## Task 5: Create lib/realtime.ts — subscription + handlers

**Files:**
- Create: `lib/realtime.ts`

- [ ] **Step 1: Implement the subscription module**

```typescript
// lib/realtime.ts
// Supabase Realtime subscription: delivers per-row events for this user's
// fasting_sessions + hydration_logs while the app is foregrounded. Handlers
// dispatch to the same helpers that syncWithRemote uses, so background
// fetch-on-open and live websocket events take identical code paths.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useUserStore } from '../stores/userStore';
import { useHydrationStore, LocalHydrationLog } from '../stores/hydrationStore';
import { applyActiveSession } from './sessionAdoption';
import { endActiveFast, syncWithRemote } from './endFast';
import { getDeviceId } from './deviceId';
import type { FastingProtocol } from '../types';

let channel: RealtimeChannel | null = null;
let ownDeviceId: string | null = null;

async function ensureDeviceId(): Promise<string> {
  if (!ownDeviceId) ownDeviceId = await getDeviceId();
  return ownDeviceId;
}

interface FastingSessionRow {
  id: string;
  user_id: string;
  protocol: FastingProtocol;
  target_hours: number;
  started_at: string;
  ended_at: string | null;
  last_modified_by_device: string | null;
}

interface HydrationLogRow {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string;
}

async function handleFastingInsert(row: FastingSessionRow) {
  const deviceId = await ensureDeviceId();
  if (row.last_modified_by_device === deviceId) return; // own echo
  if (row.ended_at) return; // already-ended on insert — shouldn't happen but safe
  await applyActiveSession(
    {
      sessionId: row.id,
      protocol: row.protocol,
      targetHours: row.target_hours,
      startedAt: row.started_at,
    },
    { isFreshStart: false },
  );
}

async function handleFastingUpdate(row: FastingSessionRow) {
  const deviceId = await ensureDeviceId();
  if (row.last_modified_by_device === deviceId) return; // own echo
  if (!row.ended_at) return; // only act on end transitions
  await endActiveFast();
}

async function handleHydrationInsert(row: HydrationLogRow) {
  const { applyRemoteLog } = useHydrationStore.getState();
  applyRemoteLog({
    id: row.id,
    amount_ml: row.amount_ml,
    logged_at: row.logged_at,
  } satisfies LocalHydrationLog);
}

function handleHydrationDelete(row: Pick<HydrationLogRow, 'id'>) {
  const { removeLogById } = useHydrationStore.getState();
  removeLogById(row.id);
}

/**
 * Open a realtime channel subscribed to this user's fasting_sessions and
 * hydration_logs. Safe to call repeatedly — no-op if already subscribed.
 * On reconnect (after a transient network drop) we run a full reconcile
 * to close any gap that happened while the socket was down.
 */
export async function startRealtime(): Promise<void> {
  if (channel) return;
  const userId = useUserStore.getState().profile?.id;
  if (!userId) return;
  await ensureDeviceId();

  channel = supabase
    .channel(`user:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fasting_sessions', filter: `user_id=eq.${userId}` },
      (p) => void handleFastingInsert(p.new as FastingSessionRow),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'fasting_sessions', filter: `user_id=eq.${userId}` },
      (p) => void handleFastingUpdate(p.new as FastingSessionRow),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'hydration_logs', filter: `user_id=eq.${userId}` },
      (p) => void handleHydrationInsert(p.new as HydrationLogRow),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'hydration_logs', filter: `user_id=eq.${userId}` },
      (p) => handleHydrationDelete(p.old as HydrationLogRow),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Full reconcile on (re)connect — catches anything we missed.
        void syncWithRemote();
      }
    });
}

export async function stopRealtime(): Promise<void> {
  if (!channel) return;
  await supabase.removeChannel(channel);
  channel = null;
}
```

Note: the own-device echo check only filters originator notifications for fasting; the hydration `applyRemoteLog` store guard handles dedup there via the `some((l) => l.id === log.id)` check.

- [ ] **Step 2: Commit**

```bash
git add lib/realtime.ts
git commit -m "feat(realtime): subscribe to fasting_sessions + hydration_logs"
```

---

## Task 6: Hydration sync on open — refetch today's logs

**Files:**
- Create: `lib/hydrationSync.ts`

- [ ] **Step 1: Add a fetch-on-open helper**

```typescript
// lib/hydrationSync.ts
// Replace today's local hydrationStore logs with whatever the server says
// we logged today. Called on app foreground alongside syncWithRemote so a
// device that missed Realtime events while backgrounded catches up before
// the user sees stale totals.

import { supabase } from './supabase';
import { useUserStore } from '../stores/userStore';
import { useHydrationStore } from '../stores/hydrationStore';

export async function syncHydrationWithRemote(): Promise<void> {
  const userId = useUserStore.getState().profile?.id;
  if (!userId) return;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('hydration_logs')
    .select('id, amount_ml, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', startOfDay.toISOString())
    .order('logged_at', { ascending: true });

  if (error) {
    console.warn('[hydrationSync] fetch failed:', error);
    return;
  }

  const store = useHydrationStore.getState();
  // Rebuild local cache from server truth — this is the reconciling path.
  store.resetIfNewDay();
  // We need a direct setter; use the existing store.setState (zustand internal).
  useHydrationStore.setState({ todayLogs: (data ?? []).map((r) => ({
    id: r.id, amount_ml: r.amount_ml, logged_at: r.logged_at,
  })) });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hydrationSync.ts
git commit -m "feat(hydration): syncHydrationWithRemote rebuilds today from server"
```

---

## Task 7: Strip local phase/halfway/water/complete scheduling from adoption

**Files:**
- Modify: `lib/sessionAdoption.ts`
- Modify: `lib/notifications.ts`
- Modify: `hooks/useFasting.ts` (indirect — nothing to change but verify)

- [ ] **Step 1: Simplify `applyActiveSession`**

In `lib/sessionAdoption.ts`, replace the notification-scheduling block (lines 75–95) with just a one-shot "start" notification on fresh starts. Full replacement of the notifications section:

```typescript
  // 2. Notifications — phase/halfway/water/complete pushes are owned by
  //    the server (scheduled_pushes + dispatch-scheduled-pushes). We only
  //    show a one-shot local "fast started" notification on fresh starts
  //    — gives the originator immediate confirmation.
  const startId = opts.isFreshStart ? await scheduleStartNotification() : '';
  const ids = startId ? [startId] : [];
  store.setNotificationIds(ids);
```

Then remove the now-unused imports at the top of `sessionAdoption.ts`:

```typescript
import {
  scheduleStartNotification,
  cancelAllNotifications,
} from './notifications';
```

(Keep `cancelAllNotifications` — it's still used in the `!opts.isFreshStart` teardown block.)

- [ ] **Step 2: Remove the now-dead exports from `lib/notifications.ts`**

Delete these functions from `lib/notifications.ts`:
- `scheduleCompletionNotification`
- `scheduleHalfwayNotification`
- `schedulePhaseNotifications` (and the `PHASE_NOTIFICATIONS` map above it)
- `scheduleWaterReminders`

Keep: `registerForPushNotifications`, `scheduleStartNotification`, `cancelScheduledNotifications`, `cancelAllNotifications`, plus the module-level `setNotificationHandler` call.

- [ ] **Step 3: Verify no stranded callers**

Run: `grep -rn "schedulePhaseNotifications\|scheduleHalfwayNotification\|scheduleCompletionNotification\|scheduleWaterReminders" /Users/denisharda/Sites/ai-cowork/fastlog --include='*.ts' --include='*.tsx'`
Expected: no output.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/sessionAdoption.ts lib/notifications.ts
git commit -m "refactor: server now owns phase/halfway/water/complete notifications"
```

---

## Task 8: Wire Realtime + hydration sync into app layout

**Files:**
- Modify: `app/_layout.tsx`
- Delete: `lib/backgroundNotifications.ts`

- [ ] **Step 1: Remove background-task imports and effect**

In `app/_layout.tsx`, delete these lines:

```typescript
import { registerBackgroundNotificationTask } from '../lib/backgroundNotifications';
```

And the effect that uses it:

```typescript
useEffect(() => {
  registerBackgroundNotificationTask();
}, []);
```

- [ ] **Step 2: Start/stop Realtime with AppState**

Add these imports near the top of `app/_layout.tsx`:

```typescript
import { AppState } from 'react-native';
import { startRealtime, stopRealtime } from '../lib/realtime';
import { syncHydrationWithRemote } from '../lib/hydrationSync';
import { syncWithRemote } from '../lib/endFast';
```

Add this effect inside `RootLayout` (after the existing push-registration effect, before the session-check effect):

```typescript
  // Realtime subscription — only while app is foregrounded and signed in.
  // Handles instant cross-device sync for fasting_sessions + hydration_logs.
  // On backgrounded → unsubscribe (save battery); the Edge Function pushes
  // carry the signal until next foreground.
  useEffect(() => {
    if (!profile?.id) return;

    void startRealtime();
    void syncHydrationWithRemote();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void startRealtime();
        void syncWithRemote();
        void syncHydrationWithRemote();
      } else {
        void stopRealtime();
      }
    });

    return () => {
      sub.remove();
      void stopRealtime();
    };
  }, [profile?.id]);
```

- [ ] **Step 3: Delete the background handler file**

Run: `rm /Users/denisharda/Sites/ai-cowork/fastlog/lib/backgroundNotifications.ts`

- [ ] **Step 4: Remove expo-task-manager from package.json**

Edit `package.json`, remove the `"expo-task-manager"` line from `dependencies`. Then:

Run: `npm install`
Expected: `expo-task-manager` removed from `node_modules` and `package-lock.json`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx package.json package-lock.json
git rm lib/backgroundNotifications.ts
git commit -m "feat: realtime subscription replaces silent-push background handler"
```

---

## Task 9: Smoke test — two devices

**Files:** (no code changes)

- [ ] **Step 1: Cold-launch on two devices signed into the same account**

Build both via `npx expo run:ios --device` on phone and simulator (or two physical devices if available). Both arrive at the timer tab.

- [ ] **Step 2: Start a fast on device A**

Expected within ~1s on device B while foregrounded: timer goes live, widget updates, ambient glow matches phase. If device B is backgrounded: within ~5s a visible "Fast started" notification appears on the lock screen. Opening device B shows the fast running with matching timer.

- [ ] **Step 3: Verify scheduled_pushes seeded**

In Supabase SQL editor: `select kind, fire_at from scheduled_pushes where session_id = '<session id>' order by fire_at;`
Expected: rows for phase boundaries < target hours, halfway, complete, hydration reminders.

- [ ] **Step 4: Log water on device A**

Expected on device B (foregrounded): water ring fill updates within ~1s. If backgrounded: no notification, but next foreground shows the updated total.

- [ ] **Step 5: Let a phase boundary pass (or manually backdate fire_at)**

For a fast acceleration test, run: `update scheduled_pushes set fire_at = now() where kind = 'phase_early_fasting' and session_id = '<id>';`
Wait up to 60s for the cron to fire.
Expected: both devices receive the "Going strong!" notification.

- [ ] **Step 6: End fast on device A**

Expected on device B (foregrounded): timer clears, widget reverts to idle, LA tears down within ~1s. If backgrounded: "Fast ended" notification appears. Verify `scheduled_pushes` is empty for that session.

- [ ] **Step 7: Commit test notes if any copy/bug tweaks emerged**

---

## Self-review (by plan author)

**Spec coverage:**
- ✅ Instant foreground sync → Realtime subscription in Task 5 + wiring in Task 8
- ✅ Same notifications on every device → `scheduled_pushes` seeded in Task 1, dispatched in Task 2
- ✅ Widget/LA on other devices → `applyActiveSession` on Realtime INSERT brings them up locally (Task 5 calls it; Task 7 preserves widget+LA+startFast path while removing only notification scheduling)
- ✅ Fetch-on-open catchup → `syncWithRemote` + `syncHydrationWithRemote` run on foreground (Task 8)
- ✅ Silent-push removal → Task 3 (visible end) + Task 8 (delete bg handler + expo-task-manager)

**Placeholder scan:** none — every step has concrete code or commands.

**Type consistency:** `FastingSessionRow`, `HydrationLogRow`, `LocalHydrationLog`, `AdoptableSession` all used with matching shapes across tasks. `kind` enum values match between migration 009 and the Edge Function test assertions.

**Known caveat not handled in this plan:**
- Live Activity cross-device bring-up when backgrounded still requires user to open the app (ActivityKit `pushToStart` is a separate phase). Foreground Realtime adoption calls `startLiveActivity` which will attempt to start one; that path works because the app is in the foreground.
- `device_tokens` can go stale (DeviceNotRegistered) — already handled by existing `reap-push-receipts` function; unchanged here.
