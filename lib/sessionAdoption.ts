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
  cancelAllNotifications,
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
  }

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
