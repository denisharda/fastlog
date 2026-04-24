import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BG_NOTIFICATION_TASK = 'fastlog-bg-notifications';

interface NotificationTaskPayload {
  data?: {
    kind?: string;
    sessionId?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

TaskManager.defineTask(BG_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[bg-notifications] task error:', error);
    return;
  }

  // Expo flattens the iOS remote-notification payload into the task's
  // `data` arg. The custom `data` object we sent from the Edge Function
  // lands at `data.data` (or sometimes `data` directly on some RN versions),
  // so check both.
  const payload = data as NotificationTaskPayload | undefined;
  const body = payload?.data ?? (payload as NotificationTaskPayload | undefined);
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

/**
 * Register the background notification task with expo-notifications.
 * Safe to call multiple times. No-op in environments that don't support
 * background notifications (Expo Go, some simulators).
 */
export async function registerBackgroundNotificationTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_NOTIFICATION_TASK);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BG_NOTIFICATION_TASK);
    }
  } catch (e) {
    // Swallow — cross-device end sync still catches up on next foreground.
    console.warn('[bg-notifications] registration failed:', e);
  }
}
