export interface FastingPhase {
  name: string;
  description: string;
  minHours: number;
  maxHours: number;
  science: string;
  tips: string[];
  metabolicMarkers: string;
}

export const FASTING_PHASES: FastingPhase[] = [
  {
    name: 'Fed State',
    description: 'Body still processing last meal',
    minHours: 0,
    maxHours: 4,
    science: 'Insulin elevated, glucose absorbing, anabolic mode. Your body is actively breaking down and absorbing nutrients from your last meal.',
    tips: ['Stay hydrated', 'Avoid snacking to let digestion complete'],
    metabolicMarkers: 'Insulin high, blood glucose elevated, mTOR active',
  },
  {
    name: 'Early Fasting',
    description: 'Insulin dropping',
    minHours: 4,
    maxHours: 8,
    science: 'Insulin levels begin to fall, blood sugar stabilizes. Your body starts transitioning from glucose metabolism to stored energy.',
    tips: ['Drink water or herbal tea', 'Stay busy to manage hunger cues'],
    metabolicMarkers: 'Insulin falling, glucagon rising, blood glucose normalizing',
  },
  {
    name: 'Fat Burning Begins',
    description: 'Glycogen depleting',
    minHours: 8,
    maxHours: 12,
    science: 'Hepatic glycogen depleting, fatty acid oxidation rising. Your liver begins releasing stored glucose while fat cells start mobilizing.',
    tips: ['Water with electrolytes helps', 'Light walking boosts fat oxidation'],
    metabolicMarkers: 'Glycogen dropping, free fatty acids rising, growth hormone increasing',
  },
  {
    name: 'Fat Burning Peak',
    description: 'Ketosis starting',
    minHours: 12,
    maxHours: 16,
    science: 'Ketone production ramps up as your body enters ketosis. Fat is now a primary energy source, and mental clarity often improves.',
    tips: ['Black coffee or green tea are fine', 'Expect a mental clarity boost'],
    metabolicMarkers: 'Ketones rising (BHB 0.5-1.0 mM), insulin at baseline, HGH elevated',
  },
  {
    name: 'Autophagy Zone',
    description: 'Cellular cleanup',
    minHours: 16,
    maxHours: 18,
    science: 'AMPK activated, mTOR suppressed, cells recycling damaged proteins. Cellular cleanup accelerates with anti-aging and repair benefits.',
    tips: ['Black coffee enhances autophagy', 'Rest if you feel low energy'],
    metabolicMarkers: 'AMPK up, mTOR suppressed, autophagy markers elevated',
  },
  {
    name: 'Deep Fast',
    description: 'Maximum benefits',
    minHours: 18,
    maxHours: Infinity,
    science: 'Maximum autophagy and fat oxidation. Your body is in a deep state of repair and regeneration. Inflammation markers typically decrease significantly.',
    tips: ['Listen to your body', 'Break fast gently with easily digestible food'],
    metabolicMarkers: 'Peak ketones (BHB 1.0-3.0 mM), inflammation markers low, deep autophagy',
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
 * Base check-in hours that always fire if within target.
 */
export const BASE_CHECKIN_HOURS = [4, 8, 12] as const;

/**
 * Returns dynamic check-in hours for a given target duration.
 * Includes base hours (4, 8, 12) plus phase-transition hours (16, 18)
 * for longer fasts. Deduplicates and sorts ascending.
 */
export function getCheckinHoursForTarget(targetHours: number): number[] {
  const hours = new Set<number>();

  for (const h of BASE_CHECKIN_HOURS) {
    if (h < targetHours) hours.add(h);
  }

  // Add phase transition check-ins for longer fasts
  for (const phase of FASTING_PHASES) {
    if (phase.minHours > 0 && phase.minHours < targetHours && phase.minHours > 12) {
      hours.add(phase.minHours);
    }
  }

  return Array.from(hours).sort((a, b) => a - b);
}

/** @deprecated Use getCheckinHoursForTarget() for dynamic scheduling */
export const CHECKIN_HOURS = BASE_CHECKIN_HOURS;
export type CheckinHour = (typeof BASE_CHECKIN_HOURS)[number];
