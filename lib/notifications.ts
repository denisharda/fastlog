import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { CHECKIN_HOURS, FASTING_PHASES } from '../constants/phases';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions and return the push token.
 * Returns null if permissions are denied or on simulator.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Notifications] Push notifications only work on physical devices.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2D6A4F',
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

// ─── Free notifications (all users) ─────────────────────────────────────────

/**
 * Schedule a single "fast started" notification immediately.
 */
export async function scheduleStartNotification(): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Fast started!",
      body: "Your fast has begun. Stay hydrated and you've got this.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });
}

/**
 * Schedule a single "fast complete" notification at the target end time.
 */
export async function scheduleCompletionNotification(
  endTime: Date
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Fast complete!",
      body: "You did it! Time to break your fast mindfully.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endTime,
    },
  });
}

/**
 * Schedule phase transition notifications (free for all users).
 * Notifies when entering each new fasting phase.
 */
export async function schedulePhaseNotifications(
  fastStartTime: Date,
  targetHours: number
): Promise<string[]> {
  const ids: string[] = [];

  for (const phase of FASTING_PHASES) {
    // Skip "Fed State" (starts at 0) — user just started
    if (phase.minHours === 0) continue;
    if (phase.minHours >= targetHours) continue;

    const triggerDate = new Date(fastStartTime.getTime() + phase.minHours * 60 * 60 * 1000);
    if (triggerDate <= new Date()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: phase.name,
        body: `${phase.minHours}h in — ${phase.description.toLowerCase()}.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    ids.push(id);
  }

  return ids;
}

// ─── Pro-only notifications (AI coach check-ins) ────────────────────────────

/**
 * Schedule AI coach check-in notifications at hours 4, 8, and 12.
 * Pro only — these prompt the user to open the app for their AI message.
 */
export async function scheduleCheckinNotifications(
  fastStartTime: Date,
  targetHours: number
): Promise<string[]> {
  const ids: string[] = [];

  for (const hour of CHECKIN_HOURS) {
    if (hour >= targetHours) continue;

    const triggerDate = new Date(fastStartTime.getTime() + hour * 60 * 60 * 1000);
    if (triggerDate <= new Date()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'AI Coach Check-in',
        body: `You're ${hour} hours in — tap for your personalized AI message.`,
        data: { fastingHour: hour },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    ids.push(id);
  }

  return ids;
}

/**
 * Cancel all pending notifications by their IDs.
 */
export async function cancelScheduledNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

/**
 * Cancel ALL scheduled notifications (e.g. on fast stop).
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
