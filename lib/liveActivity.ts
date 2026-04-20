import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { LiveActivity as LiveActivityInstance } from 'expo-widgets';
import FastingActivityFactory, { type FastingActivityState } from '../widgets/FastingActivity';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type { FastingActivityState } from '../widgets/FastingActivity';
// Legacy alias — some callers reference the old name.
export type LiveActivityState = FastingActivityState;

let activity: LiveActivityInstance<FastingActivityState> | null = null;

function available(): boolean {
  return Platform.OS === 'ios' && !isExpoGo;
}

/**
 * Start a new Live Activity. Ends any existing instance first.
 */
export async function startLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;

  await endLiveActivity();

  try {
    activity = FastingActivityFactory.start(state, 'fastlog://timer');
    if (__DEV__) console.log('[liveActivity] started');
  } catch (e) {
    console.error('[liveActivity] start failed:', e);
    activity = null;
  }
}

/**
 * Update the current Live Activity's content. No-op if none running.
 */
export async function updateLiveActivity(state: FastingActivityState): Promise<void> {
  if (!activity) return;
  try {
    await activity.update(state);
  } catch (e) {
    console.warn('[liveActivity] update failed:', e);
  }
}

/**
 * End the current Live Activity with the default dismissal policy.
 */
export async function endLiveActivity(): Promise<void> {
  if (!activity) return;
  try {
    await activity.end('default');
  } catch (e) {
    console.warn('[liveActivity] end failed:', e);
  } finally {
    activity = null;
  }
}

/**
 * Reattach to an existing Live Activity on app cold start, or start a
 * new one if none are running.
 */
export async function restoreLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;

  try {
    const existing = FastingActivityFactory.getInstances();
    if (existing.length > 0) {
      activity = existing[0];
      await updateLiveActivity(state);
      if (__DEV__) console.log('[liveActivity] reattached');
      return;
    }
  } catch (e) {
    console.warn('[liveActivity] getInstances failed:', e);
  }

  await startLiveActivity(state);
}

export function hasLiveActivity(): boolean {
  return activity !== null;
}
