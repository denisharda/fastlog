# Multi-Device Fast Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user with multiple signed-in devices (e.g. phone + tablet) sees the active fast sync across all of them: starting on one device pushes a notification to the others within seconds, and opening any of them adopts the active session (timer, Live Activity, widget, locally-scheduled phase/water/complete notifications).

**Architecture:** Two coordinated layers.

1. **Client adoption layer (Phase A).** Replace today's "reconcile or tear down" logic with a richer `syncWithRemote()` that reads the user's most recent active `fasting_sessions` row, then either *adopts* it locally (start timer + LA + widget + schedule local notifications) or *tears down* (if the session this device thinks is active was ended). Race fix: a missing row no longer triggers teardown.
2. **Server fan-out layer (Phase B + C).** A new `device_tokens` table holds one Expo push token per (user, device). A Postgres trigger on `fasting_sessions` insert calls a Supabase Edge Function (`notify-fast-event`) which fans out a "fast started on another device" push to every token belonging to the user *except* the originating device.

**Out of scope (intentionally deferred):**
- Realtime subscription for foreground-to-foreground instant sync — covered by foreground reconcile, deferred per user decision.
- Server-side fan-out of *end* events — when a fast ends remotely, other devices' phantom phase/water notifications will still fire until they next foreground. Documented as known limitation.
- Live Activity push updates via ActivityKit (substantial APNs setup, low value for this use case).

**Tech Stack:**
- Client: React Native / Expo SDK 55, TypeScript strict, Zustand, Supabase JS, expo-notifications, expo-application
- Backend: Supabase Postgres (RLS + triggers), `pg_net` extension, Supabase Edge Functions (Deno), Expo Push API
- Testing: Deno's built-in test runner for the Edge Function. Client code relies on `tsc --noEmit` + manual smoke test plans (project has no jest setup; introducing one is out of scope).

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `lib/deviceId.ts` | Generate / persist a stable device UUID in AsyncStorage (one per install). |
| `lib/deviceTokens.ts` | Register/refresh/delete the device's row in `device_tokens`. Replaces the per-profile `push_token` write. |
| `lib/sessionAdoption.ts` | Pure adoption helper: given a `fasting_sessions` row, populate the Zustand store, start LA, push widget snapshot, and schedule local notifications from the *remaining* time window. |
| `supabase/migrations/004_device_tokens.sql` | Create `device_tokens` table, RLS, and backfill from `profiles.push_token`. |
| `supabase/migrations/005_fast_event_webhook.sql` | Enable `pg_net`, create `notify_fast_event()` trigger function, attach to `fasting_sessions` AFTER INSERT. |
| `supabase/functions/notify-fast-event/index.ts` | Deno function: receive trigger payload, look up user's tokens (excluding originator), fan out to Expo Push API. |
| `supabase/functions/notify-fast-event/index.test.ts` | Deno tests covering fan-out, originator exclusion, error handling. |
| `supabase/functions/notify-fast-event/deno.json` | Deno config for the function. |

**Modified files:**

| Path | Change |
|---|---|
| `lib/endFast.ts` | Rename + rewrite `reconcileActiveFast` → `syncWithRemote`. Adds adopt path; missing row no longer tears down. |
| `hooks/useFasting.ts` | Replace inline reconcile call with `syncWithRemote`. Move local-notification scheduling for a fresh start into `sessionAdoption.ts` so `startFast` and adoption share one bring-up path. |
| `lib/notifications.ts` | Add `originDeviceId` data field on the start notification (so it can be filtered out by the recipient device — though we filter server-side, this also helps debugging). Also expose `scheduleNotificationsForRemainingFast(startedAt, targetHours, prefs)` used by adoption. |
| `app/_layout.tsx` | Replace single push-token write with `registerDeviceToken()`. Stop writing `profiles.push_token`. |
| `lib/auth.ts` | On sign-out, call `unregisterDeviceToken()` to delete this device's row. |
| `stores/fastingStore.ts` | Add `lastModifiedByDevice` field on `ActiveFast` so we know who last touched it (used by Edge Function via the DB column). |
| `supabase/migrations/006_fasting_session_origin.sql` | Add `last_modified_by_device text` column to `fasting_sessions`. (Numbered after 005 because 005's trigger needs to know about it.) |

**Wait — ordering:** migrations 004, 005, 006 must apply in order, and 005's trigger function references the `last_modified_by_device` column. So actually:

- `004_device_tokens.sql`
- `005_fasting_session_origin.sql` (adds the column first)
- `006_fast_event_webhook.sql` (now safely reads the column)

Renumbering the table accordingly throughout the plan.

---

## Phase A — Client adoption + race fix

Goal: opening the app on any device adopts the user's currently-active fast (if any) and tears down stale state without racing the optimistic insert.

### Task A1: Extract a shared "apply session" helper

**Files:**
- Create: `lib/sessionAdoption.ts`

**Why:** today the bring-up code (set Zustand state, schedule notifications, start LA, push widget snapshot) is inlined in `useFasting.ts:startFast`. Adoption needs to do the same thing from a *remote* row. Extract once so both paths share one implementation.

- [ ] **Step 1: Create `lib/sessionAdoption.ts`**

```ts
import { useFastingStore } from '../stores/fastingStore';
import { useUserStore } from '../stores/userStore';
import { getCurrentPhase } from '../constants/phases';
import { startLiveActivity } from './liveActivity';
import { pushWidgetSnapshot, scheduleWidgetTimeline } from './widget';
import {
  scheduleStartNotification,
  scheduleCompletionNotification,
  schedulePhaseNotifications,
  scheduleWaterReminders,
  scheduleHalfwayNotification,
} from './notifications';
import type { FastingProtocol } from '../types';

export interface AdoptableSession {
  sessionId: string;
  protocol: FastingProtocol;
  targetHours: number;
  startedAt: string; // ISO
}

/**
 * Bring the local app fully into sync with a fasting session — whether
 * freshly started on this device or adopted from another device.
 *
 * Idempotent: safe to call when activeFast already matches the input.
 *
 * Schedules ONLY the notifications whose trigger time is still in the future
 * (handled by the existing schedulers — they self-skip past triggers).
 *
 * Does NOT schedule the "fast started" notification when adopting — that
 * push already arrived from the server (or the user knows they started it
 * on this device a moment ago).
 */
export async function applyActiveSession(
  session: AdoptableSession,
  opts: { isFreshStart: boolean }
): Promise<string[]> {
  const store = useFastingStore.getState();
  const prefs = useUserStore.getState().notificationPrefs;

  // 1. Local state
  store.startFast({
    sessionId: session.sessionId,
    protocol: session.protocol,
    targetHours: session.targetHours,
    startedAt: session.startedAt,
    scheduledNotificationIds: [],
  });

  // 2. Notifications — schedulers self-skip past triggers, so adoption
  //    of a fast already 4h in just schedules the remaining phases.
  const start = new Date(session.startedAt);
  const endTime = new Date(start.getTime() + session.targetHours * 3600 * 1000);

  const [startId, phaseIds, completionId, waterIds, halfwayId] = await Promise.all([
    opts.isFreshStart ? scheduleStartNotification() : Promise.resolve(''),
    prefs.phaseTransitions ? schedulePhaseNotifications(start, session.targetHours) : Promise.resolve([] as string[]),
    prefs.complete ? scheduleCompletionNotification(endTime) : Promise.resolve(''),
    prefs.hydration ? scheduleWaterReminders(start, session.targetHours) : Promise.resolve([] as string[]),
    prefs.halfway ? scheduleHalfwayNotification(start, session.targetHours) : Promise.resolve(''),
  ] as const);

  const ids = [
    ...(startId ? [startId] : []),
    ...phaseIds,
    ...(completionId ? [completionId] : []),
    ...waterIds,
    ...(halfwayId ? [halfwayId] : []),
  ];
  store.setNotificationIds(ids);

  // 3. Live Activity + widget
  const elapsedH = (Date.now() - start.getTime()) / 3600000;
  const phase = getCurrentPhase(elapsedH);

  scheduleWidgetTimeline({
    startedAt: session.startedAt,
    targetHours: session.targetHours,
    protocol: session.protocol,
  });
  pushWidgetSnapshot({
    isActive: true,
    startedAt: session.startedAt,
    targetHours: session.targetHours,
    phase: phase.name,
    protocol: session.protocol,
  });

  await startLiveActivity({
    startedAt: session.startedAt,
    targetHours: session.targetHours,
    phase: phase.name,
    phaseDescription: phase.description,
    protocol: session.protocol,
  });

  return ids;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add lib/sessionAdoption.ts
git commit -m "feat(fasting): extract applyActiveSession helper for shared bring-up"
```

---

### Task A2: Use the helper from `startFast`

**Files:**
- Modify: `hooks/useFasting.ts` (replace inline bring-up in `startFast`)

- [ ] **Step 1: Replace the inline notification + LA + widget block**

In `hooks/useFasting.ts`, find the body of `startFast` (currently roughly lines 178–257). After the local store start + Supabase insert kick-off (lines 188–222), replace the entire block from `// Schedule notifications — respect user prefs` through `await startLiveActivity({...});` with a single call:

```ts
// Bring up notifications, Live Activity, widget — shared with the
// adoption path so a fast started on another device looks identical.
await applyActiveSession(
  { sessionId, protocol, targetHours: hours, startedAt },
  { isFreshStart: true }
);
```

- [ ] **Step 2: Add the import**

At the top of `hooks/useFasting.ts`, alongside the other lib imports:

```ts
import { applyActiveSession } from '../lib/sessionAdoption';
```

Then remove imports that are now unused: `scheduleStartNotification`, `scheduleCompletionNotification`, `schedulePhaseNotifications`, `scheduleWaterReminders`, `scheduleHalfwayNotification`, `startLiveActivity`, `pushWidgetSnapshot`, `scheduleWidgetTimeline`, `getCurrentPhase` (only if no other use — verify with grep first).

Run: `grep -nE "scheduleStartNotification|scheduleWaterReminders|scheduleHalfwayNotification|getCurrentPhase|pushWidgetSnapshot|scheduleWidgetTimeline|startLiveActivity" hooks/useFasting.ts`
Keep imports that still have a use; remove the rest.

- [ ] **Step 3: Confirm storeStart is still removed from destructuring**

The `storeStart` local variable is still used (by `applyActiveSession` indirectly via the store, and possibly directly if any callsite remains). Verify it's no longer referenced in `useFasting.ts` — if not, also remove from the destructure on line ~58.

Run: `grep -n "storeStart" hooks/useFasting.ts`
If no matches: edit line 58 to drop `startFast: storeStart,` from the destructure.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 5: Commit**

```bash
git add hooks/useFasting.ts
git commit -m "refactor(useFasting): startFast now uses shared applyActiveSession"
```

---

### Task A3: Rewrite `reconcileActiveFast` → `syncWithRemote`

**Files:**
- Modify: `lib/endFast.ts`

**Why:** today's reconcile tears down on missing row (the race bug) and never adopts. Rewrite to handle both directions of drift.

- [ ] **Step 1: Replace the body of `reconcileActiveFast`**

In `lib/endFast.ts`, replace the entire `reconcileActiveFast` function with:

```ts
let syncInFlight: Promise<void> | null = null;

/**
 * Bring this device's local fasting state into agreement with Supabase.
 *
 * Three possible outcomes:
 *   1. Remote has an active session (no ended_at) and local agrees → no-op.
 *   2. Remote has an active session and local doesn't (or has a different
 *      sessionId) → ADOPT it: bring up the timer, LA, widget, and schedule
 *      the remaining local notifications.
 *   3. Local has an active session and remote says it's ended (or remote
 *      has a NEWER active session) → TEAR DOWN local first; then if
 *      remote has a newer one, adopt it.
 *
 * A *missing* row for the local sessionId is treated as "still syncing"
 * and does NOT tear down — this fixes the optimistic-insert race.
 *
 * Concurrent calls coalesce.
 */
export function syncWithRemote(): Promise<void> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const profile = useUserStore.getState().profile;
    if (!profile) return;

    // Find the user's most recent active session, if any.
    const { data: remoteActive, error: remoteErr } = await supabase
      .from('fasting_sessions')
      .select('id, protocol, target_hours, started_at, ended_at')
      .eq('user_id', profile.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (remoteErr) {
      console.warn('[endFast] syncWithRemote query failed:', remoteErr);
      return;
    }

    const local = useFastingStore.getState().activeFast;

    // Case 1: nothing on either side
    if (!remoteActive && !local) return;

    // Case 2: remote has an active session
    if (remoteActive) {
      if (local && local.sessionId === remoteActive.id) {
        // Already in sync — do nothing.
        return;
      }
      // Adopt the remote session. If we have a different local one, tear
      // it down first so notifications/LA from the stale local session
      // are cleaned up before we bring up the new one.
      if (local && local.sessionId !== remoteActive.id) {
        await endActiveFast();
      }
      await applyActiveSession(
        {
          sessionId: remoteActive.id,
          protocol: remoteActive.protocol,
          targetHours: remoteActive.target_hours,
          startedAt: remoteActive.started_at,
        },
        { isFreshStart: false }
      );
      return;
    }

    // Case 3: local has a session but remote has none active.
    // Verify the local session was actually ended remotely (defensive —
    // if our local sessionId isn't in the DB at all, treat it as "still
    // syncing" and do NOT tear down).
    if (local) {
      const { data: localRow, error: rowErr } = await supabase
        .from('fasting_sessions')
        .select('ended_at')
        .eq('id', local.sessionId)
        .maybeSingle();

      if (rowErr) {
        console.warn('[endFast] syncWithRemote row check failed:', rowErr);
        return;
      }

      // Row missing → assume "insert still in flight", do NOT tear down.
      if (!localRow) return;

      // Row exists and is ended → tear down local.
      if (localRow.ended_at) {
        await endActiveFast();
      }
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
```

- [ ] **Step 2: Add the import for `applyActiveSession`**

In `lib/endFast.ts`, add at the top:

```ts
import { applyActiveSession } from './sessionAdoption';
```

- [ ] **Step 3: Remove the old `reconcileActiveFast` export**

Delete the old function entirely. Replace any export of `reconcileActiveFast` with `syncWithRemote`.

- [ ] **Step 4: Update callers**

Run: `grep -rn "reconcileActiveFast" --include="*.ts" --include="*.tsx"`

Each match should be in `hooks/useFasting.ts`. Replace `reconcileActiveFast` with `syncWithRemote` in both the import and the two call sites (the `handleAppState` listener and the mount effect).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 6: Commit**

```bash
git add lib/endFast.ts hooks/useFasting.ts
git commit -m "feat(fasting): syncWithRemote adopts cross-device fasts and stops racing inserts"
```

---

### Task A4: Manual smoke test for Phase A

This is a verification gate before Phase B begins. Run on a real iOS device or simulator with a logged-in test user.

- [ ] **Step 1: Verify the race fix**

1. Cold-launch the app.
2. Tap "Start Fast" on the Timer tab.
3. Within 1 second: confirm the timer is counting up, the Live Activity appears on the Lock Screen, and the widget shows the active state.
4. Confirm a single tap is sufficient — no need for a second tap. *This is the bug from the user's report.*

- [ ] **Step 2: Verify single-device end still works**

1. With a fast running, tap "Stop Fasting" → confirm the alert.
2. Confirm the timer clears, LA dismisses, widget returns to inactive, and no further phase/water notifications fire.

- [ ] **Step 3: Verify adoption (manual two-device proxy)**

If you only have one device, simulate two:

1. With device A signed in, run the app and start a fast.
2. Force-quit device A's app.
3. In Supabase Studio (or via SQL), open the `fasting_sessions` row and verify it's there with `ended_at IS NULL`.
4. *On the same device A* (acting as device B for this test): clear AsyncStorage by deleting the app and reinstalling → log back in.
5. On launch + after the app loads the profile, the timer should populate within ~1s, Live Activity should appear, widget should refresh.
6. Phase notifications scheduled at the original `started_at` + N hours should show up at the right times.

If you have two real devices, use them instead.

- [ ] **Step 4: Verify remote end teardown**

1. With a fast running on device A, in Supabase Studio update the row: `update fasting_sessions set ended_at = now() where id = '<id>';`
2. Background and foreground the app on A.
3. Within ~1s of foreground: timer clears, LA dismisses, widget resets, pending notifications cancelled.

- [ ] **Step 5: Commit a checkpoint message** (no code changes — just a marker)

```bash
git commit --allow-empty -m "test: Phase A smoke tests pass"
```

---

## Phase B — Schema + device_tokens registration

Goal: every signed-in device registers an Expo push token row in a new `device_tokens` table, keyed by (user_id, device_id). Existing single-device push behavior keeps working throughout.

### Task B1: Migration — add `device_tokens` table

**Files:**
- Create: `supabase/migrations/004_device_tokens.sql`

- [ ] **Step 1: Write the migration**

```sql
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
insert into public.device_tokens (user_id, device_id, push_token, platform)
select id, 'legacy-backfill', push_token, 'ios'
from public.profiles
where push_token is not null
on conflict (user_id, device_id) do nothing;
```

- [ ] **Step 2: Apply the migration**

Run (in the Supabase project the dev build points at):

```bash
supabase db push
```

Or, if not using the CLI: paste the SQL into Supabase Studio's SQL Editor and run.

Expected: no errors. `select count(*) from public.device_tokens;` returns the number of profiles that previously had a push_token.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_device_tokens.sql
git commit -m "feat(db): add device_tokens table with RLS + legacy backfill"
```

---

### Task B2: Stable per-device id

**Files:**
- Create: `lib/deviceId.ts`

- [ ] **Step 1: Write the file**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'fastlog.deviceId';

let cached: string | null = null;

/**
 * Returns a stable UUID identifying this app install. Generated once on
 * first launch and persisted in AsyncStorage. Reset by app reinstall.
 *
 * Used as the per-device key in the `device_tokens` table.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const fresh = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  cached = fresh;
  return fresh;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add lib/deviceId.ts
git commit -m "feat(client): stable per-install deviceId in AsyncStorage"
```

---

### Task B3: Device token registration helper

**Files:**
- Create: `lib/deviceTokens.ts`

- [ ] **Step 1: Write the file**

```ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { getDeviceId } from './deviceId';

/**
 * Upsert this device's push token row. Idempotent — call on every app
 * launch after the user is signed in. If the token hasn't changed, the
 * row is rewritten with a fresh updated_at; that's fine.
 */
export async function registerDeviceToken(
  userId: string,
  pushToken: string
): Promise<void> {
  const deviceId = await getDeviceId();
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  const appVersion = Constants.expoConfig?.version ?? null;

  const { error } = await supabase.from('device_tokens').upsert(
    {
      user_id: userId,
      device_id: deviceId,
      push_token: pushToken,
      platform,
      app_version: appVersion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_id' }
  );

  if (error) {
    console.warn('[deviceTokens] register failed:', error);
  }
}

/**
 * Delete this device's row for the given user. Call on sign-out so the
 * server stops fanning out pushes to this device.
 */
export async function unregisterDeviceToken(userId: string): Promise<void> {
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId);

  if (error) {
    console.warn('[deviceTokens] unregister failed:', error);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add lib/deviceTokens.ts
git commit -m "feat(client): registerDeviceToken / unregisterDeviceToken helpers"
```

---

### Task B4: Wire registration into app launch

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Replace the push-token write block**

In `app/_layout.tsx`, find the effect that calls `registerForPushNotifications()` (currently around line 104–122). Replace its body with:

```ts
useEffect(() => {
  if (!profile?.id) return;

  registerForPushNotifications()
    .then((token) => {
      if (!token) return;
      // New per-device registration — replaces the single profiles.push_token write.
      void registerDeviceToken(profile.id, token);

      // Keep the legacy profiles.push_token write for one release so
      // anything that reads it (e.g. legacy server scripts) still works.
      // TODO: remove after one release cycle.
      if (token !== profile.push_token) {
        useUserStore.getState().updateProfile({ push_token: token });
        supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', profile.id)
          .then(({ error }) => {
            if (error) console.warn('[RootLayout] Failed to save legacy push token:', error);
          });
      }
    })
    .catch((e) => {
      console.warn('[RootLayout] Push registration failed:', e);
    });
}, [profile?.id]);
```

- [ ] **Step 2: Add the import**

At the top of `app/_layout.tsx`:

```ts
import { registerDeviceToken } from '../lib/deviceTokens';
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(client): register per-device push token on launch"
```

---

### Task B5: Sign-out cleanup

**Files:**
- Modify: `lib/auth.ts` (`signOut` function)

- [ ] **Step 1: Find the signOut function**

Run: `grep -n "export async function signOut\|export function signOut" lib/auth.ts`

- [ ] **Step 2: Add the unregister call before the supabase.auth.signOut call**

Open `lib/auth.ts`, locate `signOut`. Before it calls `supabase.auth.signOut()`, capture the current user id and call `unregisterDeviceToken`:

```ts
export async function signOut() {
  // Best-effort: remove this device's push registration so the user
  // doesn't keep getting notifications on a device they've signed out of.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await unregisterDeviceToken(user.id);
  } catch (e) {
    console.warn('[auth] device token cleanup failed:', e);
  }

  // ...existing tracking + revenue cat reset + supabase signOut calls remain...
}
```

(Keep the rest of the existing function body. The cleanup runs *first* so we still have a valid auth context for the RLS-protected delete.)

- [ ] **Step 3: Add the import**

At the top of `lib/auth.ts`:

```ts
import { unregisterDeviceToken } from './deviceTokens';
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): unregister device token on sign-out"
```

---

### Task B6: Phase B smoke test

- [ ] **Step 1: Verify registration**

1. Cold-launch app on device A → log in.
2. In Supabase Studio: `select * from device_tokens where user_id = '<your-test-user>';`
3. Confirm one row exists with the device_id, ios platform, current app_version.
4. Re-launch the app → confirm `updated_at` advances on each cold launch.

- [ ] **Step 2: Verify multi-device**

1. Install on device B (or simulator profile B), log in as the same user.
2. Repeat the SQL query → confirm two rows now exist with different `device_id` values.

- [ ] **Step 3: Verify sign-out cleanup**

1. On device A, sign out via the Profile tab.
2. SQL query → device A's row is gone, device B's remains.

- [ ] **Step 4: Checkpoint commit**

```bash
git commit --allow-empty -m "test: Phase B smoke tests pass"
```

---

## Phase C — Edge Function fan-out

Goal: when a `fasting_sessions` row is inserted, every signed-in device for that user *except the originator* receives an Expo push notification.

### Task C1: Add `last_modified_by_device` column

**Files:**
- Create: `supabase/migrations/005_fasting_session_origin.sql`
- Modify: `stores/fastingStore.ts`
- Modify: `hooks/useFasting.ts` (set the field on insert + update)
- Modify: `lib/endFast.ts` (set the field on remote-update teardown — i.e. when this device ends a fast, mark itself as the modifier)
- Modify: `lib/sessionAdoption.ts` (do NOT set; adoption isn't a modification)

- [ ] **Step 1: Write the migration**

```sql
-- 005_fasting_session_origin.sql
-- Track which device was responsible for the last write to a session,
-- so the fan-out function can skip pushing back to the originator.

alter table public.fasting_sessions
  add column if not exists last_modified_by_device text;

create index if not exists fasting_sessions_user_id_active_idx
  on public.fasting_sessions (user_id, started_at desc)
  where ended_at is null;
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push` (or paste into Studio).
Expected: no errors. `\d public.fasting_sessions` shows the new column + index.

- [ ] **Step 3: Update Supabase insert in `useFasting.ts:startFast`**

In the supabase insert call (around lines 200–221), add the device id field:

```ts
import { getDeviceId } from '../lib/deviceId';

// inside startFast, before the insert:
const deviceId = await getDeviceId();

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
  .then(/* unchanged */);
```

- [ ] **Step 4: Update Supabase update in `useFasting.ts:stopFast`**

Find the supabase update inside `stopFast` (around line 282). Add the field:

```ts
const deviceId = await getDeviceId();
const { error: dbError } = await supabase
  .from('fasting_sessions')
  .update({
    ended_at: endedAt,
    completed,
    last_modified_by_device: deviceId,
  })
  .eq('id', activeFast.sessionId);
```

- [ ] **Step 5: Update Supabase update in `app/(tabs)/history.tsx:handleEndSession`**

Find `handleEndSession` (around line 256). Update the supabase call:

```ts
import { getDeviceId } from '../../lib/deviceId';

// inside handleEndSession:
const deviceId = await getDeviceId();
const { error: dbError } = await supabase
  .from('fasting_sessions')
  .update({
    ended_at: new Date().toISOString(),
    completed,
    last_modified_by_device: deviceId,
  })
  .eq('id', sessionId);
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/005_fasting_session_origin.sql hooks/useFasting.ts app/\(tabs\)/history.tsx
git commit -m "feat(db): track last_modified_by_device on fasting_sessions"
```

---

### Task C2: Scaffold the Edge Function

**Files:**
- Create: `supabase/functions/notify-fast-event/deno.json`
- Create: `supabase/functions/notify-fast-event/index.ts` (skeleton — full body in C3)

- [ ] **Step 1: Create `deno.json`**

```json
{
  "imports": {
    "std/": "https://deno.land/std@0.224.0/"
  }
}
```

- [ ] **Step 2: Create the function skeleton at `supabase/functions/notify-fast-event/index.ts`**

```ts
// Supabase Edge Function: notify-fast-event
// Triggered by a Postgres webhook on INSERT into public.fasting_sessions.
// Looks up every device_token for the session's user (excluding the
// originating device), then POSTs to Expo's push API to fan out a
// "fast started" notification.

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    user_id: string;
    protocol: string;
    target_hours: number;
    started_at: string;
    ended_at: string | null;
    last_modified_by_device: string | null;
  };
  old_record: unknown;
}

serve(async (req) => {
  // Implementation lands in Task C3.
  return new Response('ok', { status: 200 });
});
```

- [ ] **Step 3: Verify the file lands in the right location**

Run: `ls supabase/functions/notify-fast-event/`
Expected: `deno.json  index.ts`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notify-fast-event/
git commit -m "chore(edge): scaffold notify-fast-event function"
```

---

### Task C3: Implement the Edge Function (TDD)

**Files:**
- Modify: `supabase/functions/notify-fast-event/index.ts`
- Create: `supabase/functions/notify-fast-event/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/notify-fast-event/index.test.ts`:

```ts
import { assertEquals } from 'std/assert/mod.ts';
import { buildExpoMessages, shouldNotify } from './index.ts';

Deno.test('shouldNotify: ignores non-INSERT events', () => {
  const payload = {
    type: 'UPDATE' as const,
    record: { last_modified_by_device: 'a' } as any,
  };
  assertEquals(shouldNotify(payload), false);
});

Deno.test('shouldNotify: passes INSERT events', () => {
  const payload = {
    type: 'INSERT' as const,
    record: { last_modified_by_device: 'a' } as any,
  };
  assertEquals(shouldNotify(payload), true);
});

Deno.test('buildExpoMessages: excludes originating device', () => {
  const tokens = [
    { device_id: 'phone', push_token: 'ExponentPushToken[A]' },
    { device_id: 'tablet', push_token: 'ExponentPushToken[B]' },
  ];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: 'phone',
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].to, 'ExponentPushToken[B]');
});

Deno.test('buildExpoMessages: sends to all when origin device is missing from tokens', () => {
  const tokens = [
    { device_id: 'phone', push_token: 'ExponentPushToken[A]' },
    { device_id: 'tablet', push_token: 'ExponentPushToken[B]' },
  ];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: 'unknown-device',
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages.length, 2);
});

Deno.test('buildExpoMessages: handles null originDeviceId by sending to all', () => {
  const tokens = [
    { device_id: 'phone', push_token: 'ExponentPushToken[A]' },
  ];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: null,
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages.length, 1);
});

Deno.test('buildExpoMessages: title and body match brand voice', () => {
  const tokens = [{ device_id: 'tablet', push_token: 'ExponentPushToken[B]' }];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: 'phone',
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages[0].title, 'Fast started');
  assertEquals(messages[0].body, 'Your 16:8 fast is running on another device.');
  assertEquals((messages[0].data as any).sessionId, 'sess-1');
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `cd supabase/functions/notify-fast-event && deno test --allow-net`
Expected: FAIL with "module … has no exported member 'buildExpoMessages'" (or similar).

- [ ] **Step 3: Implement the function body**

Replace `supabase/functions/notify-fast-event/index.ts` with:

```ts
// Supabase Edge Function: notify-fast-event
// Triggered by a Postgres webhook on INSERT into public.fasting_sessions.

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  record: {
    id: string;
    user_id: string;
    protocol: string;
    target_hours: number;
    started_at: string;
    ended_at: string | null;
    last_modified_by_device: string | null;
  };
  old_record?: unknown;
}

export interface DeviceTokenRow {
  device_id: string;
  push_token: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function shouldNotify(payload: WebhookPayload): boolean {
  // Only fan out on a brand-new fast. End events are intentionally not
  // pushed (see plan: known limitation).
  return payload.type === 'INSERT' && !payload.record.ended_at;
}

export function buildExpoMessages(
  tokens: DeviceTokenRow[],
  args: { originDeviceId: string | null; protocol: string; sessionId: string }
): ExpoMessage[] {
  const recipients = args.originDeviceId
    ? tokens.filter((t) => t.device_id !== args.originDeviceId)
    : tokens;

  return recipients.map((t) => ({
    to: t.push_token,
    title: 'Fast started',
    body: `Your ${args.protocol} fast is running on another device.`,
    sound: 'default',
    data: { sessionId: args.sessionId, kind: 'fast_started_remote' },
  }));
}

async function sendToExpo(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[notify-fast-event] Expo push failed', res.status, body);
  }
}

serve(async (req) => {
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  if (!shouldNotify(payload)) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: tokens, error } = await supabase
    .from('device_tokens')
    .select('device_id, push_token')
    .eq('user_id', payload.record.user_id);

  if (error) {
    console.error('[notify-fast-event] token query failed', error);
    return new Response(JSON.stringify({ error: 'token query failed' }), { status: 500 });
  }

  const messages = buildExpoMessages(tokens ?? [], {
    originDeviceId: payload.record.last_modified_by_device,
    protocol: payload.record.protocol,
    sessionId: payload.record.id,
  });

  await sendToExpo(messages);

  return new Response(JSON.stringify({ sent: messages.length }), { status: 200 });
});
```

- [ ] **Step 4: Run the test — should pass**

Run: `cd supabase/functions/notify-fast-event && deno test --allow-net`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-fast-event/
git commit -m "feat(edge): notify-fast-event fans out fast-started pushes via Expo"
```

---

### Task C4: Wire up the Postgres trigger

**Files:**
- Create: `supabase/migrations/006_fast_event_webhook.sql`

- [ ] **Step 1: Write the migration**

```sql
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
-- These are read at trigger time. If unset, the trigger no-ops (the
-- http_post call still runs but to an empty URL — pg_net swallows the
-- failure silently).

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
```

- [ ] **Step 2: Configure the database settings**

In Supabase Studio → SQL Editor (or via psql), run:

```sql
alter database postgres set "app.settings.edge_url"
  = 'https://<project-ref>.functions.supabase.co';
alter database postgres set "app.settings.edge_anon_key"
  = '<anon key from Project Settings → API>';
```

(Both values come from your Supabase project settings. Project ref is the subdomain of your project URL.)

- [ ] **Step 3: Apply the migration**

Run: `supabase db push` (or paste into Studio).
Expected: no errors.

- [ ] **Step 4: Deploy the Edge Function**

Run:

```bash
supabase functions deploy notify-fast-event --no-verify-jwt
```

`--no-verify-jwt` is required because the trigger calls in with the anon key, not a user JWT.

- [ ] **Step 5: Smoke-test the function deployment**

Run:

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/notify-fast-event" \
  -H "Authorization: Bearer <anon key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","record":{"id":"x","user_id":"<your-test-user>","protocol":"16:8","target_hours":16,"started_at":"2026-04-24T00:00:00Z","ended_at":null,"last_modified_by_device":null}}'
```

Expected: `{"sent": <N>}` where N is the number of device_tokens rows for that user.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/006_fast_event_webhook.sql
git commit -m "feat(db): trigger notify-fast-event on fasting_sessions insert"
```

---

### Task C5: End-to-end smoke test

This is the verification gate for the entire plan.

- [ ] **Step 1: Two-device push test**

1. Sign the same test user into device A (or simulator A) and device B.
2. Confirm `select count(*) from device_tokens where user_id = '<test-user>'` returns 2.
3. On device A: open the app, tap Start Fast.
4. Within 1–3 seconds: device B receives a "Fast started" notification, even if device B's app is backgrounded or fully closed.
5. Tap the notification on device B → app opens → timer + LA + widget come up via the foreground adoption (Phase A).

- [ ] **Step 2: Originator suppression**

Confirm device A does NOT receive the "Fast started on another device" push (it's the originator).

- [ ] **Step 3: End-of-fast cross-device sync**

1. With a fast running on both devices (after step 1), end it on device A.
2. Background and foreground device B → confirm timer clears, LA dismisses, widget resets.
3. (Known limitation: until device B is foregrounded, any pending phase/water notifications on B will still fire. Documented for later iteration.)

- [ ] **Step 4: Sign-out cleanup**

1. Sign out on device B.
2. On device A, start a new fast.
3. Confirm device B receives NO push (its row was deleted at sign-out).

- [ ] **Step 5: Final checkpoint commit**

```bash
git commit --allow-empty -m "test: Phase C end-to-end smoke tests pass"
```

---

## Known Limitations (Documented Tradeoffs)

These are intentional gaps — addressing them is out of scope for this plan but listed so future work has a clear starting point.

1. **End-of-fast doesn't push.** When a fast ends on device A, device B doesn't get a push notification. Phantom phase/water notifications on device B will still fire until B is foregrounded. To fix: add UPDATE handler in the Edge Function that sends a silent push to all devices to wake them and cancel notifications. Requires reliable iOS background JS execution which is fragile.
2. **Live Activity on device B updates only on foreground.** The LA bar will show stale data until the user opens the app. To fix: ActivityKit push tokens + APNs server config.
3. **Widget on device B updates on iOS's own schedule.** Outside the app's control. The widget will catch up when the user wakes the device.
4. **No instant foreground-to-foreground sync.** Realtime subscription deliberately skipped. If both devices are visible side-by-side and the user starts a fast on one, the other won't update until backgrounded/foregrounded.
5. **Legacy `profiles.push_token` write retained.** Removed only after one release cycle to avoid breaking anything that reads it. Drop in a follow-up migration.

---

## Self-Review Notes

Spec coverage check:
- ✅ Race fix (no teardown on missing row) — Task A3
- ✅ Cross-device adoption on app open — Task A3 (reads remote active session) + A1 (applies it)
- ✅ Notifications fire on every signed-in device when a fast starts — Phase B + C
- ✅ Originator doesn't get its own "started elsewhere" push — Task C3 `buildExpoMessages` excludes by `last_modified_by_device`
- ✅ Sign-out stops pushes to that device — Task B5

Type consistency check:
- `applyActiveSession` signature is consistent across A1, A2, A3.
- `syncWithRemote` (renamed from `reconcileActiveFast`) is the only sync entry point — used in `useFasting.ts` mount + AppState effects.
- `device_tokens` columns are consistent across migration B1, helper B3, and Edge Function C3.
- `last_modified_by_device` column added in 005, written by client in C1 step 3–5, read by trigger in C4, used by Edge Function in C3.

No placeholder scan: all code blocks are complete, no TBD markers, no "similar to Task N" references.
