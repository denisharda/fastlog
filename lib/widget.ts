import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import FastingWidget, { type FastingState } from '../widgets/FastingWidget';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type { FastingState } from '../widgets/FastingWidget';

function available(): boolean {
  return Platform.OS === 'ios' && !isExpoGo;
}

/**
 * Immediately push a single render of the widget. Use on state changes
 * (phase transitions, app foreground, fast start/stop).
 */
export function pushWidgetSnapshot(state: FastingState): void {
  if (!available()) return;
  try {
    FastingWidget.updateSnapshot(state);
  } catch (e) {
    console.warn('[widget] updateSnapshot failed:', e);
  }
}

/**
 * Pre-schedule hourly timeline entries for an active fast. Ring fill /
 * percent stays fresh without needing JS to wake up.
 */
export function scheduleWidgetTimeline(args: {
  startedAt: string;
  targetHours: number;
  protocol: string;
}): void {
  if (!available()) return;
  const { startedAt, targetHours, protocol } = args;
  try {
    const start = new Date(startedAt);
    const entries = [] as { date: Date; props: FastingState }[];
    for (let h = 0; h <= Math.max(1, Math.ceil(targetHours)); h++) {
      const date = new Date(start.getTime() + h * 3600000);
      entries.push({
        date,
        props: {
          isActive: true,
          startedAt,
          targetHours,
          phase: phaseNameForHour(h),
          protocol,
        },
      });
    }
    FastingWidget.updateTimeline(entries);
  } catch (e) {
    console.warn('[widget] updateTimeline failed:', e);
  }
}

/**
 * Clear the widget back to the inactive layout.
 */
export function clearWidgetSnapshot(lastProtocol: string): void {
  if (!available()) return;
  try {
    FastingWidget.updateSnapshot({
      isActive: false,
      startedAt: null,
      targetHours: 0,
      phase: 'Fed State',
      protocol: lastProtocol,
    });
  } catch (e) {
    console.warn('[widget] clearWidgetSnapshot failed:', e);
  }
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
