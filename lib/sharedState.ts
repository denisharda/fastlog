import { Platform } from 'react-native';

const APP_GROUP = 'group.com.fastlog.app';
const SHARED_KEY = 'fastingState';

export interface SharedFastingState {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
  elapsedHours: number;
}

const defaultState: SharedFastingState = {
  isActive: false,
  startedAt: null,
  targetHours: 0,
  phase: 'Fed State',
  protocol: '16:8',
  elapsedHours: 0,
};

/**
 * Force WidgetKit to reload all widget timelines.
 * Call after writing shared state so the widget picks up changes immediately.
 */
function reloadWidgetTimelines(): void {
  if (Platform.OS !== 'ios') return;

  try {
    const { reloadAllTimelines } = require('expo-widgets');
    reloadAllTimelines();
  } catch {
    // expo-widgets not available (Expo Go or missing module)
  }
}

/**
 * Write fasting state to App Groups shared UserDefaults.
 * Used by iOS widgets and Live Activities to read current state.
 * Falls back silently on Android or if the native module is unavailable.
 */
export async function writeSharedState(state: SharedFastingState): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const SharedGroupPreferences = require('react-native-shared-group-preferences').default;
    await SharedGroupPreferences.setItem(SHARED_KEY, JSON.stringify(state), APP_GROUP);
    reloadWidgetTimelines();
  } catch (error) {
    // Silently fail — widget will show stale data but app continues working
    console.warn('[sharedState] Failed to write shared state:', error);
  }
}

/**
 * Read fasting state from App Groups shared UserDefaults.
 */
export async function readSharedState(): Promise<SharedFastingState> {
  if (Platform.OS !== 'ios') return defaultState;

  try {
    const SharedGroupPreferences = require('react-native-shared-group-preferences').default;
    const raw = await SharedGroupPreferences.getItem(SHARED_KEY, APP_GROUP);
    return raw ? JSON.parse(raw) : defaultState;
  } catch {
    return defaultState;
  }
}
