import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Live Activity state shape. MUST mirror `FastingActivityState` in
 * widgets/FastingActivity.tsx — the widget extension is a separate
 * bundle and Metro blocks imports across the boundary, so we duplicate
 * the type here.
 */
export interface FastingActivityState {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}
export type LiveActivityState = FastingActivityState;

function available(): boolean {
  return Platform.OS === 'ios' && !isExpoGo;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let factory: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activity: any = null;

function getFactory(): any {
  if (!available()) return null;
  if (factory) return factory;
  try {
    const mod = require('expo-widgets');
    // The layout function is ignored in the main-app bundle — the real
    // SwiftUI is compiled into the widget extension. We pass a noop.
    factory = mod.createLiveActivity(
      'FastingActivity',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (() => ({ banner: null })) as any
    );
    return factory;
  } catch {
    return null;
  }
}

/**
 * Start a new Live Activity. Ends any existing instance first.
 */
export async function startLiveActivity(state: FastingActivityState): Promise<void> {
  const f = getFactory();
  if (!f) return;

  await endLiveActivity();

  try {
    activity = f.start(state, 'fastlog://timer');
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
  const f = getFactory();
  if (!f) return;

  try {
    const existing = f.getInstances();
    if (existing && existing.length > 0) {
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
