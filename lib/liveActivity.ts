import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Live Activity helpers for iOS Dynamic Island.
 *
 * The actual widget UI is defined in widgets/FastingActivity.tsx and compiled
 * natively by the expo-widgets plugin during `npx expo prebuild`.
 *
 * At runtime, the factory only needs the activity name to match the compiled
 * widget. The native side uses the pre-compiled SwiftUI layout, not the JS
 * component passed here, so a no-op placeholder is safe.
 *
 * In Expo Go or when the native module isn't available, all calls are no-ops.
 */

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface LiveActivityState {
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

export async function startLiveActivity(state: LiveActivityState): Promise<void> {
  const f = getFactory();
  if (!f) return;

  try {
    activityInstance = f.start(state);
  } catch (e) {
    console.warn('[liveActivity] start failed:', e);
  }
}

export async function updateLiveActivity(state: Partial<LiveActivityState>): Promise<void> {
  if (!activityInstance) return;

  try {
    await activityInstance.update(state as LiveActivityState);
  } catch (e) {
    console.warn('[liveActivity] update failed:', e);
  }
}

export async function endLiveActivity(): Promise<void> {
  if (!activityInstance) return;

  try {
    await activityInstance.end('default');
    activityInstance = null;
  } catch (e) {
    console.warn('[liveActivity] end failed:', e);
  }
}
