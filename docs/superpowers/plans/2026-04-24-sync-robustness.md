# Cross-Device Sync Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the seven concrete gaps the audit surfaced on top of the multi-device sync already in place — server-authoritative timestamps, authenticated Edge Function, validated originator id, fan-out on end events, silent-push notification cancellation on other devices, push-receipt-driven token pruning, retry-to-durability for end writes, and adoption-time notification dedupe.

**Architecture:** Three layers in parallel.
- **DB (one migration):** add server default for `started_at`, add a server-authoritative `created_at` column used for sync ordering, add a `push_tickets` ledger, extend the webhook trigger to fire on UPDATE too.
- **Edge Functions:** harden `notify-fast-event` (Expo access-token auth, originator validation, silent end-push, ticket persistence). Add `reap-push-receipts` + pg_cron schedule.
- **Client:** pre-adoption notification cancellation; drop client-supplied `started_at` from inserts; durable end-write outbox; `expo-task-manager` background handler for silent end push.

**Tech Stack:** Expo SDK 55, RN 0.83, TypeScript strict, Zustand + AsyncStorage, Supabase (Postgres + pg_cron + pg_net + Vault), Supabase Edge Functions (Deno 2), Expo Push API, `expo-notifications`, `expo-task-manager`.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `supabase/migrations/008_sync_robustness.sql` | Server timestamps + `push_tickets` + UPDATE trigger extension |
| `supabase/functions/reap-push-receipts/deno.json` | Deno import map |
| `supabase/functions/reap-push-receipts/index.ts` | Polls Expo receipts, prunes stale `device_tokens`, deletes processed tickets |
| `supabase/functions/reap-push-receipts/index.test.ts` | Pure-helper tests |
| `lib/backgroundNotifications.ts` | `expo-task-manager` task that handles silent-push events (`fast_ended` cancels local scheduled notifications + tears down session) |

**Modified files:**

| Path | Change |
|---|---|
| `supabase/functions/notify-fast-event/index.ts` | Expo access-token auth; validate `last_modified_by_device`; handle UPDATE → silent push on `ended_at` transition; store tickets in `push_tickets` |
| `supabase/functions/notify-fast-event/index.test.ts` | Cover new behaviors |
| `supabase/migrations/006_fast_event_webhook.sql` | Not modified in this plan — 008 adds an AFTER UPDATE trigger separately, leaving 006 intact |
| `stores/fastingStore.ts` | Add `pendingEnd` field (persisted) for the end-write outbox |
| `hooks/useFasting.ts` | Omit `started_at` from INSERT; wrap stopFast UPDATE in retry-with-backoff + pendingEnd outbox |
| `lib/endFast.ts` | On `syncWithRemote` entry, if `pendingEnd` exists, retry-apply before querying |
| `lib/sessionAdoption.ts` | On adoption (`!isFreshStart`), cancel all pending notifications before re-scheduling to prevent native duplicates |
| `app/_layout.tsx` | Import `lib/backgroundNotifications.ts` at module top so the task registers once on bundle load |

---

## Task list (8 tasks)

## Task 1 — Migration 008: server timestamps + push_tickets + UPDATE trigger

**Files:**
- Create: `supabase/migrations/008_sync_robustness.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/008_sync_robustness.sql
git commit -m "feat(db): server timestamps + push_tickets + UPDATE trigger"
```

- [ ] **Step 3: User applies manually** — via Studio SQL Editor or `supabase db push`. Migration is idempotent (`if not exists`, `if not null` checks).

---

## Task 2 — Harden `notify-fast-event` Edge Function

**Files:**
- Modify: `supabase/functions/notify-fast-event/index.ts`
- Modify: `supabase/functions/notify-fast-event/index.test.ts`

Behaviors to add on top of the existing function:

1. Read `EXPO_ACCESS_TOKEN` from env and include `Authorization: Bearer <token>` on every call to `exp.host`.
2. Before `buildExpoMessages`, validate `last_modified_by_device`: query `device_tokens` for a row with `user_id = payload.record.user_id AND device_id = payload.record.last_modified_by_device`. If absent, treat origin as `null` (send to all).
3. Accept `type === 'UPDATE'` payloads where `payload.record.ended_at` is set. For these, construct **silent** Expo messages (no `title`, no `body`, `_contentAvailable: true`, `priority: 'high'`, `data: { kind: 'fast_ended', sessionId }`). `buildExpoMessages` should grow a third arg `kind: 'start' | 'end'`.
4. After receiving the ticket response from Expo Push, insert any `{ status: 'ok', id: <ticket_id> }` entries into `public.push_tickets` using service role, paired with the target `user_id` and recipient `device_id`.
5. Update Deno tests to cover the new originator-validation logic, the end-push payload shape, and `shouldNotify` returning true on UPDATE with `ended_at` set.

- [ ] **Step 1: Add the UPDATE-type handling to `shouldNotify`**

Current `shouldNotify` returns `true` only for INSERT-without-ended_at. Extend to also return true for UPDATE where `old_record?.ended_at === null && payload.record?.ended_at != null`. Since the trigger in migration 008 already filters on `WHEN (OLD.ended_at is null and NEW.ended_at is not null)`, the Edge Function receives only correct UPDATE payloads — but belt-and-suspenders validation here helps if the trigger is later reconfigured.

- [ ] **Step 2: Refactor `buildExpoMessages` signature**

```ts
export interface MessageArgs {
  originDeviceId: string | null;
  protocol: string;
  sessionId: string;
  kind: 'start' | 'end';
}

export function buildExpoMessages(
  tokens: DeviceTokenRow[],
  args: MessageArgs,
): ExpoMessage[] {
  const recipients = args.originDeviceId
    ? tokens.filter((t) => t.device_id !== args.originDeviceId)
    : tokens;

  if (args.kind === 'end') {
    // Silent / data-only push. Tells receivers' background task handler to
    // cancel any pending phase/water/completion notifications for this fast.
    return recipients.map((t) => ({
      to: t.push_token,
      sound: null,
      priority: 'high',
      _contentAvailable: true,
      data: { kind: 'fast_ended', sessionId: args.sessionId },
    }) as ExpoMessage);
  }

  // Visible start push.
  return recipients.map((t) => ({
    to: t.push_token,
    title: 'Fast started',
    body: `Your ${args.protocol} fast is running on another device.`,
    sound: 'default',
    data: { sessionId: args.sessionId, kind: 'fast_started_remote' },
  }));
}
```

Widen `ExpoMessage` so that `title`, `body`, `sound` can be omitted and `_contentAvailable` / `priority` added:

```ts
export interface ExpoMessage {
  to: string;
  title?: string;
  body?: string;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
  _contentAvailable?: boolean;
  data: Record<string, unknown>;
}
```

- [ ] **Step 3: Originator validation helper**

```ts
async function resolveOriginDeviceId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  claimed: string | null,
): Promise<string | null> {
  if (!claimed) return null;
  const { data } = await supabase
    .from('device_tokens')
    .select('device_id')
    .eq('user_id', userId)
    .eq('device_id', claimed)
    .maybeSingle();
  return data ? claimed : null;
}
```

Called inside the handler before `buildExpoMessages`.

- [ ] **Step 4: Authenticated push**

At module top:

```ts
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
```

Update `sendToExpo` to include:

```ts
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Accept-Encoding': 'gzip, deflate',
};
if (EXPO_ACCESS_TOKEN) {
  headers['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`;
}
```

Return the parsed JSON body so the handler can persist ticket IDs.

- [ ] **Step 5: Ticket persistence**

After `sendToExpo` returns Expo's ticket array (`res.data`), insert successful tickets:

```ts
async function persistTickets(
  supabase: ReturnType<typeof createClient>,
  tickets: Array<{ status: string; id?: string; details?: unknown }>,
  messages: ExpoMessage[],
  userId: string,
  tokenByAddress: Record<string, string>,
): Promise<void> {
  const rows = tickets
    .map((t, i) => {
      if (t.status !== 'ok' || !t.id) return null;
      const deviceId = tokenByAddress[messages[i].to];
      if (!deviceId) return null;
      return { ticket_id: t.id, user_id: userId, device_id: deviceId };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('push_tickets')
    .insert(rows);
  if (error) console.warn('[notify-fast-event] persistTickets failed:', error);
}
```

`tokenByAddress` is built from the `tokens` query by mapping `push_token → device_id`.

- [ ] **Step 6: Update tests**

Add to `index.test.ts`:

```ts
Deno.test('shouldNotify: passes UPDATE when ended_at transitions to non-null', () => {
  const payload = {
    type: 'UPDATE' as const,
    record: { ended_at: '2026-04-24T01:00:00Z' } as any,
    old_record: { ended_at: null } as any,
  };
  assertEquals(shouldNotify(payload as any), true);
});

Deno.test('shouldNotify: ignores UPDATE with no ended_at transition', () => {
  const payload = {
    type: 'UPDATE' as const,
    record: { ended_at: null } as any,
    old_record: { ended_at: null } as any,
  };
  assertEquals(shouldNotify(payload as any), false);
});

Deno.test('buildExpoMessages: end kind produces silent data-only push', () => {
  const tokens = [{ device_id: 'tablet', push_token: 'ExponentPushToken[B]' }];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: null,
    protocol: '16:8',
    sessionId: 'sess-1',
    kind: 'end',
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].title, undefined);
  assertEquals(messages[0].body, undefined);
  assertEquals(messages[0].sound, null);
  assertEquals(messages[0]._contentAvailable, true);
  assertEquals((messages[0].data as any).kind, 'fast_ended');
  assertEquals((messages[0].data as any).sessionId, 'sess-1');
});

Deno.test('buildExpoMessages: start kind still excludes origin device', () => {
  const tokens = [
    { device_id: 'phone', push_token: 'ExponentPushToken[A]' },
    { device_id: 'tablet', push_token: 'ExponentPushToken[B]' },
  ];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: 'phone',
    protocol: '16:8',
    sessionId: 'sess-1',
    kind: 'start',
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].to, 'ExponentPushToken[B]');
});
```

Update existing `buildExpoMessages` tests to pass `kind: 'start'`.

- [ ] **Step 7: Run tests**

```bash
cd supabase/functions/notify-fast-event && deno test --allow-net --allow-env
```

Expected: all passing (both legacy and new tests).

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/notify-fast-event/
git commit -m "feat(edge): auth, originator validation, end pushes, ticket persistence"
```

- [ ] **Step 9: User deploys**

```bash
supabase secrets set EXPO_ACCESS_TOKEN=<paste from EAS Dashboard — Account Settings → Access Tokens>
supabase functions deploy notify-fast-event --no-verify-jwt
```

Enable "Enhanced Push Security" in the EAS Dashboard for the app so Expo enforces the token on inbound pushes.

---

## Task 3 — New Edge Function: `reap-push-receipts`

**Files:**
- Create: `supabase/functions/reap-push-receipts/deno.json`
- Create: `supabase/functions/reap-push-receipts/index.ts`
- Create: `supabase/functions/reap-push-receipts/index.test.ts`

Runs on a pg_cron schedule every 15 minutes. Pulls `push_tickets` older than 15 minutes, fetches Expo receipts in batches of 1000, and:
- If receipt `status === 'ok'`: delete the ticket.
- If `status === 'error'` and `details.error === 'DeviceNotRegistered'`: delete the `device_tokens` row for `(user_id, device_id)` AND the ticket.
- Any other error: log, delete the ticket (we won't retry — stale tokens are eventually pruned via DeviceNotRegistered on next send).

- [ ] **Step 1: `deno.json`**

```json
{
  "imports": {
    "std/": "https://deno.land/std@0.224.0/"
  }
}
```

- [ ] **Step 2: Implement `index.ts`**

```ts
// Supabase Edge Function: reap-push-receipts
// Called on a pg_cron schedule (every 15 min). Polls Expo for delivery
// receipts for tickets we sent ≥15 min ago, prunes DeviceNotRegistered
// tokens, and deletes processed ticket rows.

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
const MAX_IDS_PER_CALL = 1000;
const AGE_MIN = 15;

export interface TicketRow {
  ticket_id: string;
  user_id: string;
  device_id: string;
}

export interface ReceiptEntry {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export function classify(entry: ReceiptEntry | undefined):
  | 'ok'
  | 'device_not_registered'
  | 'other_error'
  | 'pending' {
  if (!entry) return 'pending';
  if (entry.status === 'ok') return 'ok';
  if (entry.details?.error === 'DeviceNotRegistered') return 'device_not_registered';
  return 'other_error';
}

export async function handleRequest(_req: Request): Promise<Response> {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  const provided = _req.headers.get('x-webhook-secret');
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const cutoff = new Date(Date.now() - AGE_MIN * 60 * 1000).toISOString();

  const { data: tickets, error } = await supabase
    .from('push_tickets')
    .select('ticket_id, user_id, device_id')
    .lte('sent_at', cutoff)
    .limit(MAX_IDS_PER_CALL);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!tickets || tickets.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  const ids = tickets.map((t: TicketRow) => t.ticket_id);
  const receiptsRes = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify({ ids }),
  });
  if (!receiptsRes.ok) {
    const body = await receiptsRes.text();
    return new Response(JSON.stringify({ error: 'expo', details: body }), { status: 502 });
  }
  const payload = await receiptsRes.json();
  const receipts: Record<string, ReceiptEntry> = payload.data ?? {};

  let pruned = 0;
  let ok = 0;
  let other = 0;
  const ticketIdsToDelete: string[] = [];

  for (const t of tickets as TicketRow[]) {
    const outcome = classify(receipts[t.ticket_id]);
    if (outcome === 'pending') continue; // still in flight, leave the row
    ticketIdsToDelete.push(t.ticket_id);
    if (outcome === 'device_not_registered') {
      const { error: delErr } = await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', t.user_id)
        .eq('device_id', t.device_id);
      if (!delErr) pruned++;
    } else if (outcome === 'ok') {
      ok++;
    } else {
      other++;
    }
  }

  if (ticketIdsToDelete.length > 0) {
    await supabase.from('push_tickets').delete().in('ticket_id', ticketIdsToDelete);
  }

  return new Response(
    JSON.stringify({ processed: ticketIdsToDelete.length, ok, pruned, other }),
    { status: 200 },
  );
}

if (import.meta.main) {
  serve(handleRequest);
}
```

- [ ] **Step 3: Tests for `classify`**

```ts
// index.test.ts
import { assertEquals } from 'std/assert/mod.ts';
import { classify } from './index.ts';

Deno.test('classify: ok', () => {
  assertEquals(classify({ status: 'ok' }), 'ok');
});

Deno.test('classify: DeviceNotRegistered → device_not_registered', () => {
  assertEquals(
    classify({ status: 'error', details: { error: 'DeviceNotRegistered' } }),
    'device_not_registered',
  );
});

Deno.test('classify: other error', () => {
  assertEquals(
    classify({ status: 'error', details: { error: 'MessageRateExceeded' } }),
    'other_error',
  );
});

Deno.test('classify: missing → pending', () => {
  assertEquals(classify(undefined), 'pending');
});
```

- [ ] **Step 4: Run tests**

```bash
cd supabase/functions/reap-push-receipts && deno test --allow-net --allow-env
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/reap-push-receipts/
git commit -m "feat(edge): reap-push-receipts prunes DeviceNotRegistered tokens"
```

- [ ] **Step 6: User deploys + schedules**

```bash
supabase functions deploy reap-push-receipts --no-verify-jwt
```

Then in Studio SQL Editor, schedule it via pg_cron (requires the `pg_cron` + `pg_net` extensions, both already enabled):

```sql
create extension if not exists pg_cron with schema extensions;

-- Call reap-push-receipts every 15 minutes.
select cron.schedule(
  'reap-push-receipts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_url') || '/reap-push-receipts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
    ),
    body    := jsonb_build_object()
  );
  $$
);
```

Verify it scheduled: `select * from cron.job where jobname = 'reap-push-receipts';`

---

## Task 4 — Cancel before schedule in adoption

**Files:**
- Modify: `lib/sessionAdoption.ts`

Adoption currently calls `applyActiveSession({ ..., isFreshStart: false })`. The notification schedulers push new IDs through the OS, but any stale scheduled notifications from a previous cold-launch with a persisted `activeFast` (whose IDs were wiped from Zustand by `partialize`) remain live in the iOS notification database. Result: duplicate banners.

Fix: before scheduling, if `isFreshStart === false` or the store's `activeFast` predates what we're about to apply, cancel all scheduled notifications first.

- [ ] **Step 1: Edit `lib/sessionAdoption.ts`**

Insert above the `// 2. Notifications` comment:

```ts
import { cancelAllNotifications } from './notifications';
```

(…at the top with other imports.)

And within the function body, after the idempotency guard and after `store.startFast(...)`:

```ts
  // If this call isn't a fresh user-initiated start, there may be stale
  // native-scheduled notifications from a previous session whose IDs were
  // lost across persist rehydration. Cancel the whole pending set before
  // scheduling new ones so the OS doesn't show duplicates.
  if (!opts.isFreshStart) {
    await cancelAllNotifications();
  }
```

The file already imports from `./notifications` so grouping is natural. No behavior change for the fresh-start path (just one extra no-op when the iOS scheduled-list happens to be empty).

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | grep sessionAdoption ; echo EXIT=$?
git add lib/sessionAdoption.ts
git commit -m "fix(fasting): cancel stale notifications before adopting a session"
```

---

## Task 5 — Client: drop client-supplied `started_at` from INSERT

**Files:**
- Modify: `hooks/useFasting.ts` (around lines 190–210)

With migration 008's `default now()` on `started_at`, the server now produces an authoritative value. Client keeps its own `startedAt` for the optimistic local bring-up (timer + LA) but does NOT send it, so concurrent inserts from devices with skewed clocks produce server-ordered rows. Adoption ordering continues to rely on `syncWithRemote`'s `order('started_at' desc)` — which now returns server-set values for all rows going forward.

- [ ] **Step 1: Remove `started_at` from the insert payload**

Current (inside `startFast`):

```ts
supabase
  .from('fasting_sessions')
  .insert({
    id: sessionId,
    user_id: profile.id,
    protocol,
    target_hours: hours,
    started_at: startedAt,
    last_modified_by_device: deviceId,
  })
```

Change to:

```ts
supabase
  .from('fasting_sessions')
  .insert({
    id: sessionId,
    user_id: profile.id,
    protocol,
    target_hours: hours,
    // started_at omitted — DB default `now()` is authoritative.
    last_modified_by_device: deviceId,
  })
```

`startedAt` remains the local ISO string we hand to `applyActiveSession` for the immediate UI. On the rare cross-device mid-second race, the adopted row's server `started_at` will match within milliseconds.

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | grep useFasting ; echo EXIT=$?
git add hooks/useFasting.ts
git commit -m "feat(fasting): omit started_at from insert, let DB default own it"
```

---

## Task 6 — End-write outbox (`pendingEnd`) in fastingStore

**Files:**
- Modify: `stores/fastingStore.ts`

Add a persisted `pendingEnd` slot so an end write that fails (network, app-killed, bridge died) survives a restart and can be retried.

- [ ] **Step 1: Add the field**

```ts
export interface PendingEnd {
  sessionId: string;
  endedAt: string;      // ISO
  completed: boolean;
  deviceId: string;     // the device id that initiated the end
  attempts: number;     // incremented by the retry path; diagnostic only
}
```

Extend `FastingState`:

```ts
interface FastingState {
  activeFast: ActiveFast | null;
  pendingEnd: PendingEnd | null;
  startFast: (fast: ActiveFast) => void;
  stopFast: () => void;
  setNotificationIds: (ids: string[]) => void;
  setPendingEnd: (pending: PendingEnd | null) => void;
  incrementPendingEndAttempts: () => void;
}
```

Seed + implement:

```ts
activeFast: null,
pendingEnd: null,
// ...
setPendingEnd: (pending) => set({ pendingEnd: pending }),
incrementPendingEndAttempts: () =>
  set((state) => ({
    pendingEnd: state.pendingEnd
      ? { ...state.pendingEnd, attempts: state.pendingEnd.attempts + 1 }
      : null,
  })),
```

Update `partialize`:

```ts
partialize: (state) => ({
  activeFast: state.activeFast ? {
    ...state.activeFast,
    scheduledNotificationIds: [],
  } : null,
  pendingEnd: state.pendingEnd,
}),
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | grep fastingStore ; echo EXIT=$?
git add stores/fastingStore.ts
git commit -m "feat(fasting): pendingEnd outbox field on fastingStore"
```

---

## Task 7 — Retry-to-durability for end writes

**Files:**
- Modify: `hooks/useFasting.ts` (`stopFast` callback)
- Modify: `lib/endFast.ts` (`syncWithRemote` entry)

`stopFast` currently writes ended_at in a single `await`. Wrap in retry with backoff; on exhaustion, persist the intent in `pendingEnd`. `syncWithRemote` checks pendingEnd first and retries before doing any reconcile.

- [ ] **Step 1: Add the retry helper at the bottom of `lib/endFast.ts`**

```ts
import { useFastingStore } from '../stores/fastingStore';
// (already imported at top — keep one import)

async function attemptEndWrite(p: {
  sessionId: string;
  endedAt: string;
  completed: boolean;
  deviceId: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from('fasting_sessions')
    .update({
      ended_at: p.endedAt,
      completed: p.completed,
      last_modified_by_device: p.deviceId,
    })
    .eq('id', p.sessionId);
  return !error;
}

/**
 * Try to apply a pending end. Succeeds fast on a good network, returns false
 * on any failure. Callers may keep the pendingEnd for another retry cycle.
 */
export async function flushPendingEnd(): Promise<boolean> {
  const { pendingEnd, setPendingEnd, incrementPendingEndAttempts } =
    useFastingStore.getState();
  if (!pendingEnd) return true;

  incrementPendingEndAttempts();
  const ok = await attemptEndWrite(pendingEnd);
  if (ok) {
    setPendingEnd(null);
    return true;
  }
  return false;
}
```

- [ ] **Step 2: `syncWithRemote` tries pending end first**

At the top of the inner async in `syncWithRemote`, before reading the profile:

```ts
// Flush any unacked end first. If it's still failing, we leave it and
// proceed to reconcile — the next foreground tick will try again.
await flushPendingEnd();
```

- [ ] **Step 3: `stopFast` populates pendingEnd and retries up to 3 times**

In `hooks/useFasting.ts`, replace the current Supabase update block in `stopFast`:

```ts
if (profile) {
  const deviceId = await getDeviceId();
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [0, 500, 2000];
  const pending = {
    sessionId: activeFast.sessionId,
    endedAt,
    completed,
    deviceId,
    attempts: 0,
  };
  useFastingStore.getState().setPendingEnd(pending);

  let acked = false;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (BACKOFF_MS[i]) await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    const { error: dbError } = await supabase
      .from('fasting_sessions')
      .update({
        ended_at: endedAt,
        completed,
        last_modified_by_device: deviceId,
      })
      .eq('id', activeFast.sessionId);
    useFastingStore.getState().incrementPendingEndAttempts();
    if (!dbError) {
      acked = true;
      break;
    }
    console.warn('[useFasting] stopFast DB update failed, retrying:', dbError);
  }

  if (acked) {
    useFastingStore.getState().setPendingEnd(null);
    queryClient.invalidateQueries({ queryKey: ['fasting_sessions'] });
  } else {
    console.error('[useFasting] stopFast update exhausted retries, outbox retains it');
  }
}
```

The local teardown (already present immediately before this block via `endActiveFast`) remains — we want the UI to feel instant. The outbox protects against the DB never hearing about it.

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "useFasting|endFast|fastingStore" ; echo EXIT=$?
git add hooks/useFasting.ts lib/endFast.ts
git commit -m "feat(fasting): durable end-write outbox with retry"
```

---

## Task 8 — Background task for silent end push

**Files:**
- Create: `lib/backgroundNotifications.ts`
- Modify: `app/_layout.tsx`

When the hardened Edge Function sends `{ kind: 'fast_ended', sessionId }` as a silent push, the recipient's expo-task-manager task wakes and cancels any pending scheduled local notifications + calls `endActiveFast()`.

- [ ] **Step 1: Verify `expo-task-manager` is in `package.json`**

Run: `grep "expo-task-manager" package.json`

If missing:

```bash
npx expo install expo-task-manager
```

(The plan assumes it's installed; if not, add it before writing the file.)

- [ ] **Step 2: Create `lib/backgroundNotifications.ts`**

```ts
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BG_NOTIFICATION_TASK = 'fastlog-bg-notifications';

interface NotificationTaskPayload {
  data: {
    dataString?: string;
    // iOS puts remote-push custom data here (Expo flattens the "data" key).
    kind?: string;
    sessionId?: string;
    [k: string]: unknown;
  };
}

TaskManager.defineTask(BG_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[bg-notifications] task error:', error);
    return;
  }

  const body = (data as NotificationTaskPayload | undefined)?.data ?? (data as any);
  const kind = body?.kind;

  if (kind === 'fast_ended') {
    // Lazy-require so this module stays import-cycle-safe at app boot.
    const { endActiveFast } = await import('./endFast');
    try {
      await endActiveFast();
    } catch (e) {
      console.warn('[bg-notifications] endActiveFast failed:', e);
    }
  }
});

export async function registerBackgroundNotificationTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_NOTIFICATION_TASK);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BG_NOTIFICATION_TASK);
    }
  } catch (e) {
    // Expo Go and some simulators don't support background notifications.
    // Swallow — next cold-launch reconcile still catches the end event.
    console.warn('[bg-notifications] registration failed:', e);
  }
}
```

- [ ] **Step 3: Wire it into app startup**

In `app/_layout.tsx`, near the top alongside the other imports:

```ts
import { registerBackgroundNotificationTask } from '../lib/backgroundNotifications';
```

Inside the existing "Sync the recurring fast schedule notification on app launch" effect (or alongside it), add:

```ts
useEffect(() => {
  registerBackgroundNotificationTask();
}, []);
```

- [ ] **Step 4: Verify `app.config.ts` declares `remote-notification` background mode on iOS**

The expo-notifications config plugin already handles this for iOS when `UIBackgroundModes` includes `remote-notification`. Check `app.config.ts` or `app.json`:

Run: `grep -nE "remote-notification|backgroundModes|UIBackgroundModes" app.config.ts`

If missing, under the iOS block add:

```ts
ios: {
  // ...existing config...
  infoPlist: {
    UIBackgroundModes: ['remote-notification'],
  },
},
```

Rebuilding the dev client is required to pick up the iOS entitlement. Note this as a user-facing step in the report.

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "backgroundNotifications|_layout" ; echo EXIT=$?
git add lib/backgroundNotifications.ts app/_layout.tsx app.config.ts
git commit -m "feat(notif): background task cancels pending notifs on fast_ended push"
```

---

## Task 9 — End-to-end smoke test

This is a verification gate for the whole branch. User performs with two real iOS devices.

- [ ] **Step 1: Verify server defaults**

Start a fast on device A. In Studio, `select id, started_at, created_at, last_modified_by_device from fasting_sessions order by created_at desc limit 5;`. Confirm `started_at` and `created_at` are within ~100ms of each other (server-generated).

- [ ] **Step 2: Verify originator filtering**

Confirm device A does NOT receive its own start push. Device B does.

- [ ] **Step 3: End on device A**

Device A's Live Activity + widget dismiss immediately. Within ~1s, device B (even if backgrounded) stops firing phase/water notifications. If B is killed, the background task should wake it briefly to cancel.

- [ ] **Step 4: Push-receipt reaping**

In Studio: `select count(*) from push_tickets;` — should be non-zero immediately after a start. Wait 15+ minutes. After the cron job runs: `select count(*) from push_tickets where sent_at < now() - interval '15 minutes';` — should be zero. `select * from cron.job_run_details where jobname = 'reap-push-receipts' order by start_time desc limit 5;` shows successful runs.

- [ ] **Step 5: End-write durability**

Enable Airplane Mode on device A, tap Stop Fasting, confirm UI clears immediately. Re-enable networking. On next AppState `active`, the pending end is flushed to Supabase. Verify `select ended_at from fasting_sessions where id = '<id>';` shows the correct value.

- [ ] **Step 6: Adopt-without-duplicates**

Hard-kill device B and open it. Adoption path runs. Verify: no duplicate notifications fire over the next hour.

- [ ] **Step 7: Checkpoint commit**

```bash
git commit --allow-empty -m "test: sync robustness smoke tests pass"
```

---

## Self-Review

**Spec coverage** — all seven audit items:
1. Edge Function validates `last_modified_by_device` — Task 2 Step 3.
2. Must-succeed end writes — Tasks 6 + 7.
3. Expo access token auth — Task 2 Step 4.
4. Server-side `started_at` — Tasks 1 + 5.
5. End fan-out + background task — Tasks 1 (trigger), 2 (end push), 8 (background handler).
6. Push receipts — Tasks 1 (ledger), 2 (persistence), 3 (reaper + cron).
7. Cancel pending notifications before re-schedule on adoption — Task 4.

**Placeholder scan** — no TBDs, no "handle edge cases," every step has exact code or exact command.

**Type consistency** — `MessageArgs.kind` in Task 2 matches the type consumed by `buildExpoMessages` both there and in tests; `PendingEnd` shape in Task 6 matches consumer in Task 7; `BG_NOTIFICATION_TASK` string in Task 8 is only referenced inside `backgroundNotifications.ts`.

**Known deferrals** (intentional):
- Live Activity remote push stays out of scope.
- Realtime broadcast-from-database stays out of scope.
- UI surface for `pendingEnd` being stuck (e.g., a "syncing…" indicator) is out of scope.
