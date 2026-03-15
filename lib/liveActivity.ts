import { Platform, NativeModules } from 'react-native';

/**
 * Live Activity helpers for iOS Dynamic Island.
 *
 * The actual widget UI is defined in widgets/FastingActivity.tsx and compiled
 * natively by the expo-widgets plugin during `npx expo prebuild`.
 * At runtime, we communicate via the native module that expo-widgets registers.
 *
 * In Expo Go or when the native module isn't available, all calls are no-ops.
 */

interface LiveActivityState {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}

function getModule(): typeof NativeModules['ExpoWidgets'] | null {
  if (Platform.OS !== 'ios') return null;
  return NativeModules.ExpoWidgets ?? null;
}

export function startLiveActivity(state: LiveActivityState): void {
  const mod = getModule();
  if (!mod?.startLiveActivity) return;

  try {
    mod.startLiveActivity(JSON.stringify(state));
  } catch (e) {
    console.warn('[liveActivity] start failed:', e);
  }
}

export function updateLiveActivity(state: Partial<LiveActivityState>): void {
  const mod = getModule();
  if (!mod?.updateLiveActivity) return;

  try {
    mod.updateLiveActivity(JSON.stringify(state));
  } catch (e) {
    console.warn('[liveActivity] update failed:', e);
  }
}

export function endLiveActivity(): void {
  const mod = getModule();
  if (!mod?.endLiveActivity) return;

  try {
    mod.endLiveActivity();
  } catch (e) {
    console.warn('[liveActivity] end failed:', e);
  }
}
