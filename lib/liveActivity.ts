import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  startFastingActivity,
  updateFastingActivity,
  endFastingActivity,
  endAllFastingActivities,
  getActiveFastingActivity,
  type LiveActivityStatePayload,
} from 'fast-log-widget-bridge';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type FastingActivityState = LiveActivityStatePayload;
export type LiveActivityState = FastingActivityState;

let activeActivityId: string | null = null;

function available(): boolean {
  return Platform.OS === 'ios' && !isExpoGo;
}

/**
 * Start a new Live Activity. Ends any existing instance first so the
 * Dynamic Island never duplicates.
 */
export async function startLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;

  await endLiveActivity();

  const id = await startFastingActivity(state);
  if (id) {
    activeActivityId = id;
    if (__DEV__) console.log('[liveActivity] started', id);
  }
}

export async function updateLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;
  if (!activeActivityId) {
    // If we lost track of the id (app restart), try to reattach first.
    const existing = await getActiveFastingActivity();
    if (!existing) return;
    activeActivityId = existing;
  }
  await updateFastingActivity(activeActivityId, state);
}

export async function endLiveActivity(): Promise<void> {
  if (!available()) return;
  if (activeActivityId) {
    await endFastingActivity(activeActivityId);
    activeActivityId = null;
    return;
  }
  // Nothing tracked locally — end everything to recover from stale state.
  await endAllFastingActivities();
}

/**
 * Reattach to an existing Live Activity on app cold start, or start a
 * new one if none are running.
 */
export async function restoreLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;

  const existing = await getActiveFastingActivity();
  if (existing) {
    activeActivityId = existing;
    await updateFastingActivity(existing, state);
    if (__DEV__) console.log('[liveActivity] reattached', existing);
    return;
  }

  await startLiveActivity(state);
}

export function hasLiveActivity(): boolean {
  return activeActivityId !== null;
}
