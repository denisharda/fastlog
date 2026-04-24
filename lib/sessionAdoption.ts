import { useFastingStore } from '../stores/fastingStore';
import { getCurrentPhase } from '../constants/phases';
import { startLiveActivity } from './liveActivity';
import { pushWidgetSnapshot, scheduleWidgetTimeline } from './widget';
import {
  scheduleStartNotification,
  cancelAllNotifications,
} from './notifications';
import { syncFastSchedule } from './fastScheduler';
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

  // Idempotency: if the store already reflects this exact session and
  // this isn't a fresh start, the notifications / LA / widget are
  // already scheduled. Re-running would duplicate them and leak the
  // previous notification IDs. Short-circuit.
  if (
    !opts.isFreshStart &&
    store.activeFast?.sessionId === session.sessionId
  ) {
    return store.activeFast.scheduledNotificationIds;
  }

  // 1. Local state
  store.startFast({
    sessionId: session.sessionId,
    protocol: session.protocol,
    targetHours: session.targetHours,
    startedAt: session.startedAt,
    scheduledNotificationIds: [],
  });

  // If this call isn't a fresh user-initiated start, there may be stale
  // native-scheduled notifications from a previous session whose IDs were
  // lost across persist rehydration. Cancel the whole pending set before
  // scheduling new ones so the OS doesn't show duplicates.
  if (!opts.isFreshStart) {
    await cancelAllNotifications();
    // Re-arm the recurring fast-schedule reminder that cancelAllNotifications
    // just killed (same reason endActiveFast does it).
    await syncFastSchedule();
  }

  // 2. Notifications — phase/halfway/water/complete pushes are owned by
  //    the server (scheduled_pushes + dispatch-scheduled-pushes). We only
  //    show a one-shot local "fast started" notification on fresh starts
  //    — gives the originator immediate confirmation.
  const startId = opts.isFreshStart ? await scheduleStartNotification() : '';
  const ids = startId ? [startId] : [];
  store.setNotificationIds(ids);

  // 3. Live Activity + widget
  const start = new Date(session.startedAt);
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
