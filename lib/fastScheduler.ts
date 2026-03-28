import * as Notifications from 'expo-notifications';
import { useUserStore } from '../stores/userStore';
import type { FastSchedule } from '../stores/userStore';

const SCHEDULE_NOTIFICATION_ID_KEY = 'fast_schedule_notification';

/**
 * Calculates the next occurrence of the scheduled fast.
 * Returns a Date for the next matching day + hour.
 */
function getNextOccurrence(schedule: FastSchedule): Date | null {
  if (!schedule.enabled || schedule.days.length === 0) return null;

  const now = new Date();
  const today = now.getDay(); // 0=Sun

  // Try today first, then next 7 days
  for (let offset = 0; offset <= 7; offset++) {
    const dayIndex = (today + offset) % 7;
    if (!schedule.days.includes(dayIndex)) continue;

    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(schedule.hour, 0, 0, 0);

    if (candidate > now) {
      return candidate;
    }
  }

  return null;
}

/**
 * Schedules (or reschedules) the next recurring fast reminder notification.
 * Cancels any existing scheduled reminder first.
 */
export async function syncFastSchedule(): Promise<void> {
  // Cancel existing schedule notification
  await cancelFastSchedule();

  const schedule = useUserStore.getState().fastSchedule;
  if (!schedule || !schedule.enabled || schedule.days.length === 0) return;

  const nextDate = getNextOccurrence(schedule);
  if (!nextDate) return;

  await Notifications.scheduleNotificationAsync({
    identifier: SCHEDULE_NOTIFICATION_ID_KEY,
    content: {
      title: 'Time to fast!',
      body: `Your ${schedule.protocol} fast is scheduled — tap to begin.`,
      data: { action: 'start_fast', protocol: schedule.protocol },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextDate,
    },
  });
}

/**
 * Cancels any pending recurring fast reminder.
 */
export async function cancelFastSchedule(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(SCHEDULE_NOTIFICATION_ID_KEY);
  } catch {
    // Ignore if no notification with this ID exists
  }
}
