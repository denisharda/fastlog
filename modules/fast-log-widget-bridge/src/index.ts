import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface FastingStatePayload {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
}

export interface LiveActivityStatePayload {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}

interface NativeModule {
  setFastingState(state: FastingStatePayload): void;
  clearFastingState(): void;
  startFastingActivity(state: LiveActivityStatePayload): Promise<string>;
  updateFastingActivity(id: string, state: LiveActivityStatePayload): Promise<void>;
  endFastingActivity(id: string): Promise<void>;
  endAllFastingActivities(): Promise<void>;
  getActiveFastingActivity(): Promise<string | null>;
  areLiveActivitiesEnabled(): Promise<boolean>;
}

const native = requireOptionalNativeModule<NativeModule>('FastLogWidgetBridge');

function resolveNative(): NativeModule | null {
  if (Platform.OS !== 'ios') return null;
  return native ?? null;
}

function warn(label: string, err: unknown): void {
  if (__DEV__) console.warn(`[FastLogWidgetBridge] ${label} failed:`, err);
}

export function setFastingState(state: FastingStatePayload): void {
  const mod = resolveNative();
  if (!mod) return;
  try {
    mod.setFastingState(state);
  } catch (e) {
    warn('setFastingState', e);
  }
}

export function clearFastingState(): void {
  const mod = resolveNative();
  if (!mod) return;
  try {
    mod.clearFastingState();
  } catch (e) {
    warn('clearFastingState', e);
  }
}

export async function startFastingActivity(
  state: LiveActivityStatePayload
): Promise<string | null> {
  const mod = resolveNative();
  if (!mod) return null;
  try {
    return await mod.startFastingActivity(state);
  } catch (e) {
    warn('startFastingActivity', e);
    return null;
  }
}

export async function updateFastingActivity(
  id: string,
  state: LiveActivityStatePayload
): Promise<void> {
  const mod = resolveNative();
  if (!mod) return;
  try {
    await mod.updateFastingActivity(id, state);
  } catch (e) {
    warn('updateFastingActivity', e);
  }
}

export async function endFastingActivity(id: string): Promise<void> {
  const mod = resolveNative();
  if (!mod) return;
  try {
    await mod.endFastingActivity(id);
  } catch (e) {
    warn('endFastingActivity', e);
  }
}

export async function endAllFastingActivities(): Promise<void> {
  const mod = resolveNative();
  if (!mod) return;
  try {
    await mod.endAllFastingActivities();
  } catch (e) {
    warn('endAllFastingActivities', e);
  }
}

export async function getActiveFastingActivity(): Promise<string | null> {
  const mod = resolveNative();
  if (!mod) return null;
  try {
    return await mod.getActiveFastingActivity();
  } catch (e) {
    warn('getActiveFastingActivity', e);
    return null;
  }
}

export async function areLiveActivitiesEnabled(): Promise<boolean> {
  const mod = resolveNative();
  if (!mod) return false;
  try {
    return await mod.areLiveActivitiesEnabled();
  } catch (e) {
    warn('areLiveActivitiesEnabled', e);
    return false;
  }
}
