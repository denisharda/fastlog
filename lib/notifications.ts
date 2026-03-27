import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { FASTING_PHASES, getCheckinHoursForTarget } from '../constants/phases';
import { WATER_REMINDER_INTERVAL_HOURS } from '../constants/hydration';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
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
 * Encouraging messages per fasting phase, sent when entering each new phase.
 */
const PHASE_NOTIFICATIONS: Record<string, { title: string; body: string }> = {
  'Early Fasting': {
    title: 'Going strong!',
    body: "4h in — insulin is dropping and your body is shifting gears. Keep it up!",
  },
  'Fat Burning Begins': {
    title: "You're crushing it!",
    body: "8h fasted — glycogen is depleting and fat burning is kicking in. Stay hydrated!",
  },
  'Fat Burning Peak': {
    title: 'Halfway hero!',
    body: "12h in — ketosis is starting. Your body is tapping into fat stores now.",
  },
  'Autophagy Zone': {
    title: 'Autophagy activated!',
    body: "16h — your cells are cleaning house. This is where the magic happens.",
  },
  'Deep Fast': {
    title: 'Deep fast territory!',
    body: "18h+ — maximum autophagy and fat oxidation. You're a fasting machine.",
  },
};

/**
 * Schedule phase transition notifications (free for all users).
 * Sends an encouraging message when entering each new fasting phase.
 * Uses Promise.all to schedule all notifications in parallel.
 */
export async function schedulePhaseNotifications(
  fastStartTime: Date,
  targetHours: number
): Promise<string[]> {
  const promises: Promise<string>[] = [];

  for (const phase of FASTING_PHASES) {
    if (phase.minHours === 0) continue;
    if (phase.minHours >= targetHours) continue;

    const msg = PHASE_NOTIFICATIONS[phase.name];
    if (!msg) continue;

    const triggerDate = new Date(fastStartTime.getTime() + phase.minHours * 60 * 60 * 1000);
    if (triggerDate <= new Date()) continue;

    promises.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      })
    );
  }

  return Promise.all(promises);
}

// ─── Pro-only notifications (AI coach check-ins) ────────────────────────────

/**
 * Schedule AI coach check-in notifications at dynamic hours based on target.
 * Includes base hours (4, 8, 12) plus phase-transition hours (16, 18) for longer fasts.
 * Pro only — these prompt the user to open the app for their AI message.
 * Uses Promise.all to schedule all notifications in parallel.
 */
export async function scheduleCheckinNotifications(
  fastStartTime: Date,
  targetHours: number
): Promise<string[]> {
  const promises: Promise<string>[] = [];
  const checkinHours = getCheckinHoursForTarget(targetHours);

  for (const hour of checkinHours) {
    const triggerDate = new Date(fastStartTime.getTime() + hour * 60 * 60 * 1000);
    if (triggerDate <= new Date()) continue;

    promises.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'AI Coach Check-in',
          body: `You're ${hour} hours in — tap for your personalized AI message.`,
          data: { fastingHour: hour },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      })
    );
  }

  return Promise.all(promises);
}

// ─── Water reminder notifications ─────────────────────────────────────────

const MAX_WATER_REMINDERS = 12; // 24 hours of coverage, prevents exceeding iOS 64-notification limit

/**
 * Schedule hydration reminders every 2 hours during a fast.
 * Capped at MAX_WATER_REMINDERS to stay within iOS notification limits.
 * Uses Promise.all to schedule all notifications in parallel.
 */
export async function scheduleWaterReminders(
  fastStartTime: Date,
  targetHours: number
): Promise<string[]> {
  const promises: Promise<string>[] = [];
  const now = Date.now();
  let count = 0;

  for (let h = WATER_REMINDER_INTERVAL_HOURS; h < targetHours; h += WATER_REMINDER_INTERVAL_HOURS) {
    if (count >= MAX_WATER_REMINDERS) break;

    const triggerDate = new Date(fastStartTime.getTime() + h * 60 * 60 * 1000);
    if (triggerDate.getTime() <= now) continue;

    promises.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Stay Hydrated',
          body: `You're ${h} hours into your fast. Remember to drink water!`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      })
    );

    count++;
  }

  return Promise.all(promises);
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
