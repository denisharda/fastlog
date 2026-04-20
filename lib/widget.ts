import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  setFastingState,
  clearFastingState,
  type FastingStatePayload,
} from 'fast-log-widget-bridge';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type FastingState = FastingStatePayload;

function available(): boolean {
  return Platform.OS === 'ios' && !isExpoGo;
}

/**
 * Push a single render of the widget. Used on state changes (phase
 * transitions, app foreground, fast start/stop).
 *
 * Implementation: writes the JSON state to the shared App Group
 * UserDefaults, then asks WidgetKit to reload the FastingWidget
 * timeline. The native Swift TimelineProvider reads that blob back.
 */
export function pushWidgetSnapshot(state: FastingState): void {
  if (!available()) return;
  setFastingState(state);
}

/**
 * Pre-schedule a timeline for the active fast. The native
 * TimelineProvider already generates forward-looking entries from a
 * single snapshot, so this is a thin alias that shares the same code
 * path — kept for call-site compatibility.
 */
export function scheduleWidgetTimeline(args: {
  startedAt: string;
  targetHours: number;
  protocol: string;
}): void {
  if (!available()) return;
  const { startedAt, targetHours, protocol } = args;
  setFastingState({
    isActive: true,
    startedAt,
    targetHours,
    phase: phaseNameForHour(0),
    protocol,
  });
}

/**
 * Clear the widget back to the inactive layout.
 */
export function clearWidgetSnapshot(lastProtocol: string): void {
  if (!available()) return;
  setFastingState({
    isActive: false,
    startedAt: null,
    targetHours: 0,
    phase: 'Fed State',
    protocol: lastProtocol,
  });
}

/**
 * Fully erase the shared state. Rarely needed; `clearWidgetSnapshot`
 * is the preferred path because it leaves the widget in a "ready"
 * layout rather than a blank placeholder.
 */
export function eraseWidgetState(): void {
  if (!available()) return;
  clearFastingState();
}

const PHASE_BY_MIN_HOUR: readonly [number, string][] = [
  [18, 'Deep Fast'],
  [16, 'Autophagy Zone'],
  [12, 'Fat Burning Peak'],
  [8, 'Fat Burning Begins'],
  [4, 'Early Fasting'],
  [0, 'Fed State'],
];

function phaseNameForHour(h: number): string {
  for (const [min, name] of PHASE_BY_MIN_HOUR) {
    if (h >= min) return name;
  }
  return 'Fed State';
}
