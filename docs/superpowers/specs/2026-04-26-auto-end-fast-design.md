# Auto-end Fasts at Target — Design

## Problem

Three related bugs surfaced in production:

1. **Fasts run forever past target.** Nothing in the codebase ends a session at `started_at + target_hours`. The CTA on the Timer screen relabels to "Complete Fast" past target, but the user has to tap it manually. Backgrounded devices don't end at all.
2. **No completion notification fired** for a fast that ran past target. The existing `complete` row in `scheduled_pushes` should have fired but didn't (likely the recently-fixed EAS `projectId` issue, but the underlying design also tightly couples "complete notification" to "user notification preference" rather than to "fast actually ended").
3. **Live Activity tap leaves the app stuck on the in-app `ActivityIndicator`.** `app/_layout.tsx`'s `getSession()` call has no `.catch`, so any rejection leaves `isLoading=true` forever and the spinner never hides.

The user wants: the fast ends precisely at target, every device finds out (push when backgrounded, Realtime when foregrounded), and tapping the LA / push / coming back to the app surfaces the success drawer once for that completed fast.

## Goals

- Auto-end every active fast at exactly `started_at + target_hours * interval '1 hour'`, server-authoritative, with a client foreground fallback.
- One completion push per fast, gated by `notification_prefs.complete`, regardless of whether the user has the app open.
- Show `/fast-complete` exactly once per ended session, on whatever surface the user lands on next (LA tap, push tap, foreground, cold launch).
- Stop the launch spinner from getting stuck when `getSession()` fails.

## Non-goals

- A user-facing "extend past target" toggle.
- Live Activity tear-down animation changes beyond what `endActiveFast()` already does.
- Backfilling already-overdue fasts via a one-shot migration — the new cron picks them up on its next minute.

## Architecture

### Spine: server-authoritative auto-end

A new pg_cron job runs every minute and ends due fasts. The existing `notify-fast-event` UPDATE trigger and `reap_scheduled_pushes_on_end` UPDATE trigger handle fan-out and cleanup unchanged. The existing scheduled `complete`-kind push goes away — completion is no longer a separately-scheduled event; it's a side effect of the auto-end UPDATE.

Net flow at target time:

```
pg_cron (every minute)
  ↓ calls
auto_end_due_fasts()
  ↓ UPDATE fasting_sessions SET ended_at = ..., completed = true,
      last_modified_by_device = 'system:auto-end'
  ↓ fires
notify-fast-event trigger → Edge Function → Expo push (all devices, gated by notification_prefs.complete)
  ↓ fires
reap_scheduled_pushes_on_end trigger → DELETE remaining future scheduled rows (phase/halfway/water)
  ↓ Supabase Realtime broadcasts the row UPDATE
foreground devices' lib/realtime.ts handleFastingUpdate → endActiveFast() locally
```

Why server-side primary: the LA, widget, and second devices need to stop at the exact target moment with no user action. A cron tick gives ~0–60s latency at the source of truth; everything downstream is push or websocket and is sub-second.

### Client foreground fallback

`useFasting.ts`'s existing `AppState` 'active' handler gains: if `activeFast` is non-null and `Date.now() >= startedAt + targetHours*3600000` and there's no pending end, call `stopFast(true)` ourselves. Idempotent via the `pendingEnd` outbox + `fasting_sessions_one_active_per_user` partial unique index — if the server already auto-ended, the local update is a `23505` no-op handled by the existing adoption path.

This guards against pg_cron lag, edge function blips, or a device that comes back online after a long gap.

### Drawer surfacing — single "unseen completion" rule

Two new persisted fields in `fastingStore`:
- `lastEndedSessionId: string | null` — the most recent session this device knows ended.
- `lastSeenEndedSessionId: string | null` — the most recent session for which `/fast-complete` was shown.

Three write sites for `lastEndedSessionId`:
- `lib/endFast.ts` `endActiveFast()` — set when local end completes (covers manual stop + foreground-fallback auto-end).
- `lib/realtime.ts` `handleFastingUpdate` — set when an `ended_at` transition arrives from another author (covers server auto-end and ends from sibling devices).
- `lib/endFast.ts` `syncWithRemote()` — set when reconcile discovers an end the local store had missed (covers cold launch hours after the fact).

One read site: an effect at the top of `app/_layout.tsx` (mounted once auth is resolved) that watches `lastEndedSessionId` vs. `lastSeenEndedSessionId`. When they differ, it `router.push('/fast-complete')` and updates `lastSeenEndedSessionId` to the current value.

That's the entire rule. LA tap and push tap don't need any new routing — they just bring the app to the foreground or cold-launch it, and the effect handles the rest.

### Splash unstick

`app/_layout.tsx` lines 232–238 become:

```ts
supabase.auth.getSession()
  .then(({ data: { session } }) => setSession(session))
  .catch((e) => console.error('[RootLayout] getSession failed:', e))
  .finally(() => setIsLoading(false));
```

Plus a 5-second safety timeout that force-flips `isLoading` if it's still true and logs a warning. Plus deferring the `Linking.getInitialURL()` handler until `!isLoading`, so deep-link routing happens against a known-stable navigator rather than racing the auth gate.

The catch alone is the minimal correct fix; the timeout and deferred handling are belt-and-suspenders to prevent regressions if a future code path introduces a different hang.

## Database changes

`supabase/migrations/013_auto_end_fasts.sql`:

1. **Drop the `complete` kind from the seed trigger.** Recreate `seed_scheduled_pushes()` (originally in migration 009, last touched in 010) without the `complete` row. Existing scheduled `complete` rows for in-flight fasts get deleted in the same migration so old fans don't fire on already-running fasts.
2. **Add `auto_end_due_fasts()`** — SECURITY DEFINER function that performs the bulk UPDATE described above. Pinned `search_path` per the project's security convention (see migration 007).
3. **Schedule via pg_cron** every minute. Idempotent — on conflict, `cron.schedule` returns the existing job id.
4. The function uses `last_modified_by_device = 'system:auto-end'` as a sentinel. Originator-skip in `notify-fast-event` only matches against entries in `device_tokens`, so this sentinel value never matches and every real device gets the push. (Confirmed by reading the edge function: it skips a token only when `last_modified_by_device` matches a token row's `device_id`.)

Existing triggers untouched:
- `reap_scheduled_pushes_on_end` UPDATE trigger deletes remaining future scheduled rows.
- `fasting_sessions_one_active_per_user` partial unique index keeps client-side fallback ends idempotent.

## Edge function changes

`supabase/functions/notify-fast-event/index.ts` needs two changes — both small, both required for this design:

1. **Gate end pushes on `notification_prefs.complete`.** The function currently fans out every fast-end event unconditionally. Read `profiles.notification_prefs->>'complete'` for the user; if false, skip the push. (Start pushes stay unconditional — they're the cross-device "fast started" sync ping, not a celebration.)
2. **Branch end-push copy on origin.** Today the body is hardcoded to `"Your {protocol} fast ended on another device."` — wrong tone when the end was automatic. When `last_modified_by_device === 'system:auto-end'`, send title "Beautifully done." / body "Your {protocol} fast is complete." When it was authored by another real device, keep the existing "ended on another device" body. Both branches keep `data: { kind: 'fast_ended', sessionId }` so the existing notification-response listener path is unchanged (and the unseen-completion effect handles the post-tap drawer).

## Client changes

| File | Change |
|---|---|
| `stores/fastingStore.ts` | Add `lastEndedSessionId`, `lastSeenEndedSessionId` (both persisted) and setters |
| `lib/endFast.ts` | `endActiveFast()` writes `lastEndedSessionId`; `syncWithRemote()` writes it on cold-launch reconcile |
| `lib/realtime.ts` | `handleFastingUpdate` writes `lastEndedSessionId` on remote-authored end |
| `hooks/useFasting.ts` | AppState 'active' effect adds the foreground fallback (call `stopFast(true)` if past target) |
| `app/_layout.tsx` | Add `.catch`+`finally` to `getSession`, 5s safety timeout, defer initial-URL handler until `!isLoading`, add the unseen-end → `/fast-complete` effect |

## Edge cases

- **Multiple ends stacked up:** `lastEndedSessionId` only ever holds the most recent. Earlier unseen ends are silently dropped — the user sees only the latest. Acceptable: stacking would only happen for a user who completed multiple fasts without opening the app, which is rare and not worth a queue.
- **Race between server auto-end and client foreground fallback:** the client's `stopFast(true)` calls `endActiveFast()` first (clears local state), then UPDATEs Supabase. If the server already wrote `ended_at`, the UPDATE returns no rows changed; if it returns 23505 on the unique index, the existing adoption path handles it. Either way the end is visible.
- **User has `notification_prefs.complete = false`:** the auto-end still happens (decoupled from notifications now). They get no push but the LA/widget tear down via Realtime, and the drawer pops the next time the app opens.
- **Cron lag (>60s):** the foreground fallback covers it for any device that opens the app in the gap. Pure backgrounded devices wait until cron catches up — acceptable; the worst-case latency for an end notification is ~2 minutes.

## Open questions for implementation

1. Verify the deep-link handler currently in `app/_layout.tsx` (lines 178–191) doesn't have any state it needs to capture before being deferred. Reading it: just calls `router.push('/(tabs)')` on URLs to `timer` or `start`. Safe to defer.

This is a confirmation step during implementation, not a design ambiguity.

## Why this shape

- **One end mechanism, one push:** auto-end IS the completion event. No separate scheduled `complete` push to dedupe against the end-trigger fan-out.
- **One drawer rule:** "unseen completion" replaces three separate triggers (LA tap, push tap, manual stop) with a single state comparison run on every surface the user can land on.
- **Server primary, client fallback:** the LA and widget can only tear down at the right moment if the server stamps `ended_at` independent of any device. The client fallback is cheap insurance, not the primary path.
- **Splash unstick is independent:** the catch+finally is correct regardless of whether `getSession()` ever actually fails — the absence of error handling is a real bug, just one that surfaces rarely.
