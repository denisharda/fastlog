import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface LiveActivityState {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let factory: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activityInstance: any = null;

function getFactory(): any {
  if (Platform.OS !== 'ios' || isExpoGo) return null;
  if (factory) return factory;

  try {
    const mod = require('expo-widgets');
    factory = mod.createLiveActivity(
      'FastingActivity',
      (() => ({ banner: null })) as any
    );
    return factory;
  } catch {
    return null;
  }
}

/**
 * End any currently running live activity. Safe to call even if no activity
 * is running — silently no-ops.
 */
export async function endLiveActivity(): Promise<void> {
  if (!activityInstance) return;

  try {
    await activityInstance.end('default');
  } catch (e) {
    console.warn('[liveActivity] end failed:', e);
  } finally {
    activityInstance = null;
  }
}

/**
 * Start a new live activity. Ends any existing activity first to avoid orphans.
 */
export async function startLiveActivity(state: LiveActivityState): Promise<void> {
  const f = getFactory();
  if (!f) return;

  // End any existing activity before starting a new one
  await endLiveActivity();

  try {
    activityInstance = await f.start(state);
    if (__DEV__) console.log('[liveActivity] started successfully');
  } catch (e) {
    console.error('[liveActivity] start failed:', e);
    activityInstance = null;
  }
}

/**
 * Update the running live activity with new state.
 * Sends a full state object to avoid partial/undefined fields on the native side.
 */
export async function updateLiveActivity(
  partial: Partial<LiveActivityState>,
  currentFull: LiveActivityState
): Promise<void> {
  if (!activityInstance) return;

  try {
    // Merge partial into full state to avoid sending undefined fields
    const merged: LiveActivityState = { ...currentFull, ...partial };
    await activityInstance.update(merged);
  } catch (e) {
    console.warn('[liveActivity] update failed:', e);
  }
}

/**
 * Attempt to reconnect to an existing live activity after app restart.
 * Since expo-widgets doesn't expose activity querying, start a fresh one.
 * iOS will dismiss the old one if we start a new one for the same activity type.
 */
export async function restoreLiveActivity(state: LiveActivityState): Promise<void> {
  const f = getFactory();
  if (!f) return;

  try {
    activityInstance = await f.start(state);
    if (__DEV__) console.log('[liveActivity] restored successfully');
  } catch (e) {
    console.warn('[liveActivity] restore failed:', e);
    activityInstance = null;
  }
}

/**
 * Whether a live activity instance is currently held in memory.
 */
export function hasLiveActivity(): boolean {
  return activityInstance !== null;
}
