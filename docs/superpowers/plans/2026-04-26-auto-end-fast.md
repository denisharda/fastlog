# Auto-end Fasts at Target — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End fasts server-authoritatively at target time, fan out one celebratory push gated by `notification_prefs.complete`, and surface the `/fast-complete` drawer exactly once per ended session via a single "unseen completion" rule. Also unstick the in-app launch spinner when `getSession()` rejects.

**Architecture:** Server-side pg_cron writes `ended_at` and `completed = true` at exact target moment using a sentinel `last_modified_by_device = 'system:auto-end'`. The existing `notify-fast-event` UPDATE trigger fans out the push (newly gated on `notification_prefs.complete`, with branched copy when the originator is the system). Realtime broadcasts the row UPDATE to foreground devices. A new `lastEndedSessionId` / `lastSeenEndedSessionId` pair on the fastingStore drives a single effect in `app/_layout.tsx` that pushes `/fast-complete` once per ended session. Client foreground fallback covers cron lag. `getSession()` gets `.catch`+`.finally`+timeout to keep `isLoading` from getting stuck.

**Tech Stack:** Supabase Postgres + pg_cron + Realtime, Deno Edge Function, RLS, Zustand persist (AsyncStorage), Expo Router, React Query.

**Project test reality:** No JS/RN test runner. `npm run lint` script is broken (eslint not installed). Verification per task is `npm run typecheck` plus targeted manual smoke tests on iOS sim/device. Database verification is via the Supabase SQL editor.

**Spec:** `docs/superpowers/specs/2026-04-26-auto-end-fast-design.md`

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `supabase/migrations/013_auto_end_fasts.sql` | Create | Drop `complete` kind from seed trigger; delete existing future `complete` rows; add `auto_end_due_fasts()`; schedule pg_cron `auto-end-due-fasts` every minute |
| `supabase/functions/notify-fast-event/index.ts` | Modify | Gate end pushes on `profiles.notification_prefs->>'complete'`; branch end copy on `last_modified_by_device === 'system:auto-end'` |
| `stores/fastingStore.ts` | Modify | Add `lastEndedSessionId`, `lastSeenEndedSessionId` (persisted) + `setLastEndedSessionId`, `setLastSeenEndedSessionId` |
| `lib/endFast.ts` | Modify | `endActiveFast()` captures `activeFast.sessionId` before tear-down and writes it to `lastEndedSessionId` |
| `lib/realtime.ts` | Modify | `handleFastingUpdate` writes `lastEndedSessionId` for remote-authored ends (in addition to calling `endActiveFast`) |
| `hooks/useFasting.ts` | Modify | AppState 'active' effect adds the foreground fallback: if past target with no pendingEnd, call `stopFast(true)` |
| `app/_layout.tsx` | Modify | `.catch`+`.finally` on `getSession`; 5s safety timeout for `isLoading`; defer `Linking.getInitialURL()` until `!isLoading`; add unseen-completion → `/fast-complete` effect |
| `app/(tabs)/index.tsx` | Modify | Remove the now-redundant explicit `router.push('/fast-complete')` from the manual-stop path (effect handles it) |

---

## Task 1: Migration 013 — server-side auto-end

**Files:**
- Create: `supabase/migrations/013_auto_end_fasts.sql`

- [ ] **Step 1: Write the migration**

Write `supabase/migrations/013_auto_end_fasts.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase dashboard SQL editor (paste the file's contents into a new query and click Run). Project: FastAI (`yimxfuxwgtkkbglveglp`).

Expected: "Success. No rows returned." If `pg_cron` extension isn't enabled, the `cron.schedule` call errors — should be already enabled (migration 009 / 010 used it).

- [ ] **Step 3: Verify the migration**

In the Supabase SQL editor, run:

```sql
-- Function exists
select proname from pg_proc where proname = 'auto_end_due_fasts';

-- Cron job is scheduled
select jobname, schedule, command from cron.job where jobname = 'auto-end-due-fasts';

-- seed_scheduled_pushes no longer references 'complete'
select position('''complete''' in pg_get_functiondef('public.seed_scheduled_pushes'::regproc)) as complete_pos;
```

Expected:
- `auto_end_due_fasts` row returned.
- One cron job named `auto-end-due-fasts` with schedule `* * * * *`.
- `complete_pos` = `0` (substring not present).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_auto_end_fasts.sql
git commit -m "feat(db): server-side auto-end at target via pg_cron"
```

---

## Task 2: Edge function — gate prefs + branch copy

**Files:**
- Modify: `supabase/functions/notify-fast-event/index.ts`

- [ ] **Step 1: Add prefs gating + branched end copy**

Open `supabase/functions/notify-fast-event/index.ts`. Find the existing `buildExpoMessages` function (lines 56-83) and the place where it's called inside the request handler. We need three changes:

a) Extend `MessageArgs` to carry the originator string so `buildExpoMessages` can branch:

Replace the existing `MessageArgs` interface (around line 38):

```ts
export interface MessageArgs {
  originDeviceId: string | null;
  protocol: string;
  sessionId: string;
  kind: 'start' | 'end';
}
```

with:

```ts
export interface MessageArgs {
  originDeviceId: string | null;
  protocol: string;
  sessionId: string;
  kind: 'start' | 'end';
  /** Raw `last_modified_by_device` value. Used to branch end-push copy
   * when the system auto-ended the fast vs. another user-owned device. */
  endOrigin?: string | null;
}
```

b) Replace `buildExpoMessages` (the full function) with a version that branches the end copy:

```ts
export function buildExpoMessages(
  tokens: DeviceTokenRow[],
  args: MessageArgs,
): ExpoMessage[] {
  const recipients = args.originDeviceId
    ? tokens.filter((t) => t.device_id !== args.originDeviceId)
    : tokens;

  if (args.kind === 'end') {
    const isAutoEnd = args.endOrigin === 'system:auto-end';
    const title = isAutoEnd ? 'Beautifully done.' : 'Fast ended';
    const body = isAutoEnd
      ? `Your ${args.protocol} fast is complete.`
      : `Your ${args.protocol} fast ended on another device.`;
    return recipients.map((t) => ({
      to: t.push_token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: { kind: 'fast_ended', sessionId: args.sessionId },
    }));
  }

  return recipients.map((t) => ({
    to: t.push_token,
    title: 'Fast started',
    body: `Your ${args.protocol} fast is running on another device.`,
    sound: 'default',
    data: { sessionId: args.sessionId, kind: 'fast_started_remote' },
  }));
}
```

c) Add `notification_prefs.complete` gating + pass `endOrigin` to `buildExpoMessages`. In `handleRequest`, the `kind` variable is computed at line 193 and `buildExpoMessages` is called at lines 195-200. The supabase client is already in scope from line 175.

Locate this exact block (lines 193-200):

```ts
  const kind: 'start' | 'end' = payload.type === 'UPDATE' ? 'end' : 'start';

  const messages = buildExpoMessages(tokens ?? [], {
    originDeviceId: origin,
    protocol: payload.record.protocol,
    sessionId: payload.record.id,
    kind,
  });
```

Replace with:

```ts
  const kind: 'start' | 'end' = payload.type === 'UPDATE' ? 'end' : 'start';

  if (kind === 'end') {
    // Honor the user's complete-pref toggle. Phase-transition / start
    // pushes don't go through this gate.
    const { data: profile, error: prefsErr } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', payload.record.user_id)
      .maybeSingle();
    if (prefsErr) {
      console.warn('[notify-fast-event] notification_prefs lookup failed:', prefsErr);
    }
    const prefs = (profile?.notification_prefs ?? {}) as { complete?: boolean };
    const completeEnabled = prefs.complete ?? true;
    if (!completeEnabled) {
      console.log('[notify-fast-event] user has complete-pref disabled, skipping end push');
      return new Response(JSON.stringify({ skipped: 'complete_pref_disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const messages = buildExpoMessages(tokens ?? [], {
    originDeviceId: origin,
    protocol: payload.record.protocol,
    sessionId: payload.record.id,
    kind,
    endOrigin: payload.record.last_modified_by_device,
  });
```

Note: `endOrigin` is the RAW `last_modified_by_device` from the row (passes through `'system:auto-end'`), while `originDeviceId` is the resolved/validated value from `resolveOriginDeviceId` (returns `null` for unrecognized origins like the system sentinel, which means the recipient filter is a no-op and every real device is included — exactly what we want for auto-end).

- [ ] **Step 2: Typecheck the edge function**

Edge functions don't go through `tsc`, but Deno will type-check them at deploy. Run a quick type check via the Deno CLI if available:

```bash
deno check supabase/functions/notify-fast-event/index.ts 2>&1 | tail -20
```

Expected: no errors. If `deno` isn't installed, skip this step — deployment will catch any issue.

- [ ] **Step 3: Deploy the edge function**

```bash
supabase functions deploy notify-fast-event --project-ref yimxfuxwgtkkbglveglp
```

Expected: "Deployed Function notify-fast-event". If the CLI isn't linked, the user runs `supabase login` first (interactive) or deploys via the dashboard's Functions tab (paste the file contents into the editor and click Deploy).

- [ ] **Step 4: Smoke test the function**

In the Supabase SQL editor, fire a test UPDATE that simulates an auto-end on a real session row. Replace `<session-id>` with an active session id (or create a throwaway one). Watch the function logs (Supabase dashboard → Edge Functions → notify-fast-event → Logs) for:
- A request received.
- Either the prefs-skip log line OR a successful Expo push attempt.
- Title/body branching: when `last_modified_by_device = 'system:auto-end'`, body should read `"Your <protocol> fast is complete."`

(This is an optional sanity check — the cron-driven path will exercise it for real on the next test fast.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-fast-event/index.ts
git commit -m "feat(edge): gate end pushes on complete-pref; branch copy on auto-end"
```

---

## Task 3: fastingStore — `lastEndedSessionId` plumbing

**Files:**
- Modify: `stores/fastingStore.ts`

- [ ] **Step 1: Add the two fields, two setters, and persist them**

Replace the `FastingState` interface and the entire store implementation in `stores/fastingStore.ts` with:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FastingProtocol } from '../types';

export interface ActiveFast {
  sessionId: string;
  protocol: FastingProtocol;
  targetHours: number;
  startedAt: string; // ISO string — persisted across app restarts
  scheduledNotificationIds: string[];
}

export interface PendingEnd {
  sessionId: string;
  endedAt: string;
  completed: boolean;
  deviceId: string;
  attempts: number;
}

interface FastingState {
  activeFast: ActiveFast | null;
  pendingEnd: PendingEnd | null;
  /** Most recent session id this device has observed ending, from any
   *  source (local stop, Realtime UPDATE, syncWithRemote tear-down). */
  lastEndedSessionId: string | null;
  /** Most recent session id for which `/fast-complete` was surfaced.
   *  When `lastEndedSessionId !== lastSeenEndedSessionId`, the layout
   *  effect pushes the modal once and bumps `lastSeenEndedSessionId`. */
  lastSeenEndedSessionId: string | null;
  startFast: (fast: ActiveFast) => void;
  stopFast: () => void;
  setNotificationIds: (ids: string[]) => void;
  setPendingEnd: (pending: PendingEnd | null) => void;
  incrementPendingEndAttempts: () => void;
  setLastEndedSessionId: (id: string | null) => void;
  setLastSeenEndedSessionId: (id: string | null) => void;
}

export const useFastingStore = create<FastingState>()(
  persist(
    (set) => ({
      activeFast: null,
      pendingEnd: null,
      lastEndedSessionId: null,
      lastSeenEndedSessionId: null,

      startFast: (fast) => {
        set({ activeFast: fast });
      },

      stopFast: () => {
        set({ activeFast: null });
      },

      setNotificationIds: (ids) =>
        set((state) => ({
          activeFast: state.activeFast
            ? { ...state.activeFast, scheduledNotificationIds: ids }
            : null,
        })),

      setPendingEnd: (pending) => set({ pendingEnd: pending }),
      incrementPendingEndAttempts: () =>
        set((state) => ({
          pendingEnd: state.pendingEnd
            ? { ...state.pendingEnd, attempts: state.pendingEnd.attempts + 1 }
            : null,
        })),

      setLastEndedSessionId: (id) => set({ lastEndedSessionId: id }),
      setLastSeenEndedSessionId: (id) => set({ lastSeenEndedSessionId: id }),
    }),
    {
      name: 'fasting-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeFast: state.activeFast ? {
          ...state.activeFast,
          scheduledNotificationIds: [],
        } : null,
        pendingEnd: state.pendingEnd,
        lastEndedSessionId: state.lastEndedSessionId,
        lastSeenEndedSessionId: state.lastSeenEndedSessionId,
      }),
    }
  )
);
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add stores/fastingStore.ts
git commit -m "feat(store): add lastEndedSessionId / lastSeenEndedSessionId"
```

---

## Task 4: `endActiveFast` writes `lastEndedSessionId`

**Files:**
- Modify: `lib/endFast.ts`

- [ ] **Step 1: Capture the session id before tear-down and write it**

In `lib/endFast.ts`, replace the existing `endActiveFast` function (lines 18-32) with:

```ts
export async function endActiveFast(): Promise<void> {
  const { activeFast, stopFast, setLastEndedSessionId } = useFastingStore.getState();
  const lastProtocol = activeFast?.protocol ?? '16:8';
  const endedSessionId = activeFast?.sessionId ?? null;

  stopFast();
  if (endedSessionId) setLastEndedSessionId(endedSessionId);

  await Promise.all([
    cancelAllNotifications(),
    endLiveActivity(),
  ]);
  clearWidgetSnapshot(lastProtocol);
  // cancelAllNotifications also killed the recurring fast-schedule reminder.
  // Re-arm it immediately so the user keeps getting their scheduled pings.
  await syncFastSchedule();
}
```

(The new line is the `setLastEndedSessionId` write right after `stopFast()`. This covers manual stops, Realtime-driven tear-downs, and the syncWithRemote ended-row path — every call site hits the same code.)

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/endFast.ts
git commit -m "feat(end): endActiveFast writes lastEndedSessionId"
```

---

## Task 5: Realtime — write `lastEndedSessionId` for remote-authored ends

**Files:**
- Modify: `lib/realtime.ts`

- [ ] **Step 1: Update `handleFastingUpdate` to also stamp the flag**

In `lib/realtime.ts`, find `handleFastingUpdate` (around lines 57-62 with current code). The current logic ends the local fast when a remote-authored `ended_at` transition arrives. We add the flag write so devices that didn't have a local activeFast (e.g., a sibling device that adopted late) still get the drawer.

Replace the function with:

```ts
async function handleFastingUpdate(row: FastingSessionRow) {
  const deviceId = await ensureDeviceId();
  if (row.last_modified_by_device === deviceId) return; // own echo
  if (!row.ended_at) return; // only act on end transitions

  // Stamp the flag BEFORE tearing down, so the case where this device
  // had no local activeFast (and therefore endActiveFast wouldn't know
  // the session id) still surfaces the drawer.
  useFastingStore.getState().setLastEndedSessionId(row.id);

  await endActiveFast();
}
```

- [ ] **Step 2: Add the import**

If `useFastingStore` isn't already imported in this file, add it to the imports at the top:

```ts
import { useFastingStore } from '../stores/fastingStore';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/realtime.ts
git commit -m "feat(realtime): stamp lastEndedSessionId on remote-authored end"
```

---

## Task 6: useFasting — foreground fallback auto-end

**Files:**
- Modify: `hooks/useFasting.ts`

- [ ] **Step 1: Extend the AppState 'active' effect**

In `hooks/useFasting.ts`, locate the effect that handles `AppState` (currently lines 102-125). Replace the body of `handleAppState` so that when the app foregrounds and the local fast has elapsed past target with no in-flight pendingEnd, it ends locally. Idempotent via the existing `pendingEnd` outbox + the `fasting_sessions_one_active_per_user` partial unique index.

Replace the effect with:

```tsx
  useEffect(() => {
    function handleAppState(nextState: AppStateStatus) {
      if (nextState !== 'active') return;

      if (activeFast) {
        const elapsedMs = Date.now() - new Date(activeFast.startedAt).getTime();
        const targetMs = activeFast.targetHours * 3600000;
        const pendingEnd = useFastingStore.getState().pendingEnd;

        // Foreground fallback for server auto-end. If cron lagged or this
        // device was offline when target hit, end locally now.
        if (elapsedMs >= targetMs && !pendingEnd) {
          // stopFast(true) handles its own DB write + outbox retry. We
          // don't await — keep this handler synchronous-ish for AppState.
          void stopFast(true);
        } else {
          const elapsed = elapsedMs / 3600000;
          const phase = getCurrentPhase(elapsed);
          pushWidgetSnapshot({
            isActive: true,
            startedAt: activeFast.startedAt,
            targetHours: activeFast.targetHours,
            phase: phase.name,
            protocol: activeFast.protocol,
          });
        }
      }

      // Always reconcile on foreground — covers both directions of drift:
      // a fast ended elsewhere (tear down) AND a fast started elsewhere
      // while this device had no local session (adopt).
      syncWithRemote();
    }

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [activeFast, stopFast]);
```

(Note the dependency array now includes `stopFast` so the latest version of the callback is captured.)

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useFasting.ts
git commit -m "feat(fasting): foreground fallback ends fast past target"
```

---

## Task 7: `app/_layout.tsx` — splash unstick + drawer surfacing

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Replace the auth-load effect with `.catch`+`.finally`+timeout**

In `app/_layout.tsx`, locate the effect that calls `supabase.auth.getSession()` (currently lines 230-248). Replace the inner block of the `useEffect` with:

```tsx
  useEffect(() => {
    try { initPostHog(); } catch (e) { console.warn('[RootLayout] PostHog init failed:', e); }
    try { trackAppLaunched(); } catch (e) { /* silent */ }

    // Belt-and-suspenders timeout — guarantees the spinner unsticks even
    // if getSession hangs. 5s is generous; AsyncStorage-backed lookups
    // typically resolve in <100ms.
    const safety = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) console.warn('[RootLayout] getSession timeout — forcing isLoading false');
        return false;
      });
    }, 5000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch((e) => console.error('[RootLayout] getSession failed:', e))
      .finally(() => {
        clearTimeout(safety);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);
```

- [ ] **Step 2: Defer the `Linking.getInitialURL()` handler until `!isLoading`**

Locate the deep-link effect (currently lines 184-201). Split it into two effects: one always-on listener for in-app URL events, and one that handles the initial URL only after auth resolves.

Replace the existing single effect:

```tsx
  // Handle deep links from widget
  useEffect(() => {
    function handleURL(event: { url: string }) {
      const { hostname } = Linking.parse(event.url);
      if (hostname === 'timer' || hostname === 'start') {
        router.push('/(tabs)');
      }
    }

    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) handleURL({ url });
    });

    // Handle URLs while app is running
    const sub = Linking.addEventListener('url', handleURL);
    return () => sub.remove();
  }, []);
```

with two effects:

```tsx
  // Handle deep links arriving while the app is running.
  useEffect(() => {
    function handleURL(event: { url: string }) {
      const { hostname } = Linking.parse(event.url);
      if (hostname === 'timer' || hostname === 'start') {
        router.push('/(tabs)');
      }
    }
    const sub = Linking.addEventListener('url', handleURL);
    return () => sub.remove();
  }, []);

  // Handle the URL that launched the app, but only after auth has
  // resolved so the navigator + protected-route guard are stable.
  useEffect(() => {
    if (isLoading) return;
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      const { hostname } = Linking.parse(url);
      if (hostname === 'timer' || hostname === 'start') {
        router.push('/(tabs)');
      }
    });
  }, [isLoading]);
```

- [ ] **Step 3: Add the unseen-completion → `/fast-complete` effect**

At the top of the imports, add:

```ts
import { useFastingStore } from '../stores/fastingStore';
```

(Skip if already imported.)

Inside the `RootLayout` component body, after the `useProtectedRoute(session, isLoading);` call (around line 250), add:

```tsx
  const lastEndedSessionId = useFastingStore((s) => s.lastEndedSessionId);
  const lastSeenEndedSessionId = useFastingStore((s) => s.lastSeenEndedSessionId);

  useEffect(() => {
    if (isLoading) return;
    if (!lastEndedSessionId) return;
    if (lastEndedSessionId === lastSeenEndedSessionId) return;
    router.push('/fast-complete');
    useFastingStore.getState().setLastSeenEndedSessionId(lastEndedSessionId);
  }, [isLoading, lastEndedSessionId, lastSeenEndedSessionId]);
```

(Gating on `!isLoading` ensures the navigator is mounted; the order in the body — after `useProtectedRoute` — keeps the auth-redirect logic ahead of the modal push so an unauthenticated cold-launch still lands on `/(auth)/welcome` rather than racing into `/fast-complete`.)

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "fix(layout): unstick spinner; defer initial URL; surface unseen end"
```

---

## Task 8: Remove the now-redundant `router.push('/fast-complete')` from manual stop

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Drop the explicit modal push**

In `app/(tabs)/index.tsx`, find the `handleStop` callback (currently lines 119-148). Inside the `Complete` confirmation branch, the `onPress` calls `await stopFast(true); ... router.push('/fast-complete'); ...`. The `router.push` is now handled by the layout effect (since `stopFast` → `endActiveFast` writes `lastEndedSessionId`).

Replace:

```tsx
        {
          text: 'Complete',
          onPress: async () => {
            await stopFast(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push('/fast-complete');
            if (!isPro && !hasSeenSuccessPaywall) {
              setHasSeenSuccessPaywall(true);
            }
          },
        },
```

with:

```tsx
        {
          text: 'Complete',
          onPress: async () => {
            await stopFast(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // /fast-complete is now surfaced by the layout effect that
            // watches lastEndedSessionId — see app/_layout.tsx.
            if (!isPro && !hasSeenSuccessPaywall) {
              setHasSeenSuccessPaywall(true);
            }
          },
        },
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "refactor(timer): drop manual fast-complete push (layout effect handles it)"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 2: Confirm migration is committed and applied**

```bash
ls supabase/migrations/013_auto_end_fasts.sql
git log --oneline -- supabase/migrations/013_auto_end_fasts.sql supabase/functions/notify-fast-event/index.ts
```

Confirm the migration file exists and was committed in Task 1, and that the edge function change was committed in Task 2 and deployed.

- [ ] **Step 3: Smoke walkthrough — server auto-end, foreground**

1. Cold-launch the app on the iOS simulator.
2. Sign in (or use existing session).
3. Start a 16:8 fast on Device A. Confirm the timer ticks.
4. In Supabase SQL editor, simulate target reached by setting `started_at` ~16h in the past:

```sql
update public.fasting_sessions
set started_at = now() - interval '16 hours' - interval '5 minutes'
where id = '<the just-created session id>';
```

5. Within ~60s of the next minute boundary, the cron runs `auto_end_due_fasts()`. On Device A (foregrounded), Realtime delivers the UPDATE → tear-down → `lastEndedSessionId` is written → `/fast-complete` modal pops automatically.
6. Confirm the modal appears and the timer is reset. Tap a mood and Save (this also exercises Task 8 of the prior plan).

- [ ] **Step 4: Smoke walkthrough — push notification path**

1. Background the app on Device A.
2. Repeat the simulated target-reached step from Step 3 with a new fast.
3. Within ~60s, a push notification arrives titled "Beautifully done." with body "Your 16:8 fast is complete."
4. Tap the push → app foregrounds → `/fast-complete` drawer appears.

- [ ] **Step 5: Smoke walkthrough — splash unstick**

1. Force-quit the app.
2. Cold-launch via the iOS home-screen icon and via the Live Activity tap (if active). Confirm the in-app `ActivityIndicator` disappears within ~1s in both cases. (The fix is defensive — without an actual `getSession` failure to reproduce, we can only verify the new code paths typecheck and don't regress the happy path.)

- [ ] **Step 6: No further commit unless something needed touching up.**

All commits should already be in place from per-task commits.

---

## Out of scope (deferred)

Per the design spec — explicitly NOT in this plan:

- A user-facing "extend past target" toggle.
- Any Live Activity tear-down animation polish beyond what `endActiveFast` already does.
- Backfilling already-overdue fasts via a one-shot migration. The new cron picks them up on its next minute.
- A queue for surfacing multiple stacked unseen completions. Only the most recent is shown.
- Surfacing the drawer for fasts that ended hours before a fresh device cold-launches with no local activeFast — `syncWithRemote` only writes `lastEndedSessionId` when it actually tears down a local active session.
