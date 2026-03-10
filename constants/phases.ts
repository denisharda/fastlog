export interface FastingPhase {
  name: string;
  description: string;
  minHours: number;
  maxHours: number;
}

export const FASTING_PHASES: FastingPhase[] = [
  {
    name: 'Fed State',
    description: 'Body still processing last meal',
    minHours: 0,
    maxHours: 4,
  },
  {
    name: 'Early Fasting',
    description: 'Insulin dropping',
    minHours: 4,
    maxHours: 8,
  },
  {
    name: 'Fat Burning Begins',
    description: 'Glycogen depleting',
    minHours: 8,
    maxHours: 12,
  },
  {
    name: 'Fat Burning Peak',
    description: 'Ketosis starting',
    minHours: 12,
    maxHours: 16,
  },
  {
    name: 'Autophagy Zone',
    description: 'Cellular cleanup',
    minHours: 16,
    maxHours: 18,
  },
  {
    name: 'Deep Fast',
    description: 'Maximum benefits',
    minHours: 18,
    maxHours: Infinity,
  },
];

/**
 * Returns the fasting phase for a given elapsed hours value.
 * Falls back to the last phase if no match is found.
 */
export function getCurrentPhase(elapsedHours: number): FastingPhase {
  return (
    FASTING_PHASES.find(
      (p) => elapsedHours >= p.minHours && elapsedHours < p.maxHours
    ) ?? FASTING_PHASES[FASTING_PHASES.length - 1]
  );
}

/**
 * Returns the checkin-eligible hours within a given target fast duration.
 * Notifications are scheduled at hours 4, 8, and 12.
 */
export const CHECKIN_HOURS = [4, 8, 12] as const;
export type CheckinHour = (typeof CHECKIN_HOURS)[number];
