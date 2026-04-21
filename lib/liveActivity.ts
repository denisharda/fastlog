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

// Module-scoped state. Because this module may be imported by multiple
// hooks (index.tsx + water.tsx both mount useFasting), ALL coordination
// must live here so parallel calls don't each spawn a new activity.
let activeActivityId: string | null = null;
// Signature (startedAt|targetHours) of the session the current activity
// represents — used to dedupe start calls triggered by effects that fire
// on every render or from multiple tab screens simultaneously.
let activeSessionSignature: string | null = null;
// In-flight promise — any overlapping start/restore call awaits this one
// instead of racing the native side.
let startInFlight: Promise<void> | null = null;
let endInFlight: Promise<void> | null = null;

function available(): boolean {
  return Platform.OS === 'ios' && !isExpoGo;
}

function signatureFor(state: FastingActivityState): string {
  return `${state.startedAt}|${state.targetHours}|${state.protocol}`;
}

/**
 * Start a new Live Activity. Ends any existing instance first so the
 * Dynamic Island never duplicates. Safe to call from parallel effects /
 * multiple mounted hook consumers — concurrent calls for the same session
 * coalesce into a single native request, and mismatched sessions queue.
 */
export async function startLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;

  const signature = signatureFor(state);

  // Fast path: we already have an activity for this exact session — do not
  // tear it down and re-request (that's the duplicate-banner root cause).
  if (activeActivityId && activeSessionSignature === signature) {
    return;
  }

  // Coalesce concurrent starts for the same session onto one promise.
  if (startInFlight) {
    await startInFlight;
    if (activeActivityId && activeSessionSignature === signature) return;
  }

  startInFlight = (async () => {
    // End any existing activity (tracked OR orphaned on the native side).
    await endLiveActivityInternal();

    const id = await startFastingActivity(state);
    if (id) {
      activeActivityId = id;
      activeSessionSignature = signature;
      if (__DEV__) console.log('[liveActivity] started', id, signature);
    }
  })();

  try {
    await startInFlight;
  } finally {
    startInFlight = null;
  }
}

export async function updateLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;
  if (!activeActivityId) {
    // If we lost track of the id (app restart), try to reattach first.
    const existing = await getActiveFastingActivity();
    if (!existing) return;
    activeActivityId = existing;
    activeSessionSignature = signatureFor(state);
  }
  await updateFastingActivity(activeActivityId, state);
}

async function endLiveActivityInternal(): Promise<void> {
  if (activeActivityId) {
    await endFastingActivity(activeActivityId);
    activeActivityId = null;
    activeSessionSignature = null;
    return;
  }
  // Nothing tracked locally — end everything to recover from stale state
  // (bundle reload, previous crash, upgrade from a buggy build, etc.).
  await endAllFastingActivities();
  activeSessionSignature = null;
}

export async function endLiveActivity(): Promise<void> {
  if (!available()) return;

  if (endInFlight) {
    await endInFlight;
    return;
  }
  endInFlight = endLiveActivityInternal();
  try {
    await endInFlight;
  } finally {
    endInFlight = null;
  }
}

export async function restoreLiveActivity(state: FastingActivityState): Promise<void> {
  if (!available()) return;

  const signature = signatureFor(state);

  // If we already have an activity tracked for this session, nothing to do.
  if (activeActivityId && activeSessionSignature === signature) return;

  // Try to reattach to any existing native activity before requesting a new
  // one. This handles app restart where the JS module lost its id but the
  // iOS system still has the activity alive.
  const existing = await getActiveFastingActivity();
  if (existing) {
    activeActivityId = existing;
    activeSessionSignature = signature;
    // Push current state to refresh its contents without creating a new one.
    try {
      await updateFastingActivity(existing, state);
    } catch {
      // fall through to start
    }
    return;
  }

  await startLiveActivity(state);
}

export function hasLiveActivity(): boolean {
  return activeActivityId !== null;
}
