import { useFastingStore } from '../stores/fastingStore';
import { useUserStore } from '../stores/userStore';
import { cancelAllNotifications } from './notifications';
import { endLiveActivity } from './liveActivity';
import { clearWidgetSnapshot } from './widget';
import { syncFastSchedule } from './fastScheduler';
import { supabase } from './supabase';
import { applyActiveSession } from './sessionAdoption';

/**
 * Tear down every side-effect that a running fast holds onto:
 * Zustand store, scheduled notifications, Live Activity, widget snapshot.
 *
 * Must be called from every path that ends a fast — the Timer's stop/complete,
 * the History drawer's end-session, and sign-out. Leaving any of these out
 * produces a zombie Live Activity or ghost notifications after the fast is over.
 */
export async function endActiveFast(): Promise<void> {
  const { activeFast, stopFast } = useFastingStore.getState();
  const lastProtocol = activeFast?.protocol ?? '16:8';

  stopFast();

  await Promise.all([
    cancelAllNotifications(),
    endLiveActivity(),
  ]);
  clearWidgetSnapshot(lastProtocol);
  // cancelAllNotifications also killed the recurring fast-schedule reminder.
  // Re-arm it immediately so the user keeps getting their scheduled pings.
  await syncFastSchedule();
}

let syncInFlight: Promise<void> | null = null;

/**
 * Bring this device's local fasting state into agreement with Supabase.
 *
 * Three possible outcomes:
 *   1. Remote has an active session (no ended_at) and local agrees → no-op
 *      (applyActiveSession's idempotency guard short-circuits).
 *   2. Remote has an active session and local doesn't (or has a different
 *      sessionId) → ADOPT it: bring up the timer, LA, widget, and schedule
 *      the remaining local notifications.
 *   3. Local has an active session and remote says it's ended → tear down.
 *
 * A *missing* row for the local sessionId is treated as "still syncing"
 * and does NOT tear down — this fixes the optimistic-insert race.
 *
 * Concurrent calls coalesce onto a single in-flight promise.
 */
export function syncWithRemote(): Promise<void> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    // Flush any unacked end from a prior stopFast before we reconcile. If
    // it's still failing we proceed — the next foreground tick will try
    // again — so a transient failure doesn't block adoption logic.
    await flushPendingEnd();
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
        // Already in sync — applyActiveSession would short-circuit too,
        // but returning here avoids an unneeded round-trip.
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
    // Verify the local session was actually ended remotely — if the row
    // isn't in the DB at all, treat it as "insert still in flight" and
    // do NOT tear down.
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

      // Row missing → "insert still in flight", do NOT tear down.
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
 * Try to apply a pending end write. Called before syncWithRemote each
 * foreground so an unacked stop doesn't leave a ghost fast on the server.
 * Succeeds fast on a good network; returns false on any failure so the
 * pendingEnd entry stays in the outbox for the next attempt.
 */
export async function flushPendingEnd(): Promise<boolean> {
  // Wait for persist rehydration to complete so we see any pendingEnd
  // persisted from a previous session that died mid-retry. Without this
  // gate, a cold launch would run before AsyncStorage finished loading,
  // see pendingEnd: null, and let syncWithRemote re-adopt a fast the
  // user already stopped (timer resurrection).
  if (!useFastingStore.persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsub = useFastingStore.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }

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
