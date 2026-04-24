import { useFastingStore } from '../stores/fastingStore';
import { useUserStore } from '../stores/userStore';
import { cancelAllNotifications } from './notifications';
import { endLiveActivity } from './liveActivity';
import { clearWidgetSnapshot } from './widget';
import { syncFastSchedule } from './fastScheduler';
import { supabase } from './supabase';

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

let reconcileInFlight: Promise<void> | null = null;

/**
 * Ask Supabase whether the session this device thinks is active was already
 * ended elsewhere (another device, the web dashboard, etc.). If so, tear
 * everything down locally. Multiple mounted hooks + AppState listeners can
 * call this concurrently — the in-flight promise coalesces them.
 */
export function reconcileActiveFast(): Promise<void> {
  if (reconcileInFlight) return reconcileInFlight;

  reconcileInFlight = (async () => {
    const { activeFast } = useFastingStore.getState();
    if (!activeFast) return;
    const profile = useUserStore.getState().profile;
    if (!profile) return;

    const { data, error } = await supabase
      .from('fasting_sessions')
      .select('ended_at')
      .eq('id', activeFast.sessionId)
      .maybeSingle();

    if (error) {
      console.warn('[endFast] reconcile failed:', error);
      return;
    }

    // Row missing (deleted remotely) OR ended elsewhere → tear down locally.
    if (!data || data.ended_at) {
      await endActiveFast();
    }
  })().finally(() => {
    reconcileInFlight = null;
  });

  return reconcileInFlight;
}
