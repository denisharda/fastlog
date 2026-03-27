/** Quick-add water amounts in ml */
export const QUICK_ADD_AMOUNTS = [250, 500] as const;

/** Default daily water goal in ml */
export const DEFAULT_DAILY_WATER_GOAL_ML = 2000;

/** Min/max for daily goal stepper in ml */
export const MIN_DAILY_WATER_GOAL_ML = 500;
export const MAX_DAILY_WATER_GOAL_ML = 5000;
export const WATER_GOAL_STEP_ML = 250;

/** Reminder interval during a fast (hours) */
export const WATER_REMINDER_INTERVAL_HOURS = 2;

/** Add-water sheet stepper constants */
export const WATER_STEPPER_INCREMENT_ML = 50;
export const MIN_ADD_AMOUNT_ML = 50;
export const MAX_ADD_AMOUNT_ML = 1500;
export const DEFAULT_ADD_AMOUNT_ML = 250;

/**
 * Phase-aware hydration tips shown on the water screen during a fast.
 * Keys match phase names from constants/phases.ts.
 */
export const PHASE_HYDRATION_TIPS: Record<string, string> = {
  'Fed State': 'Water aids digestion — keep sipping',
  'Early Fasting': 'Hunger? Try a glass of water first',
  'Fat Burning Begins': 'Electrolytes help — add a pinch of salt',
  'Fat Burning Peak': 'Ketosis increases water loss — drink up',
  'Autophagy Zone': 'Water helps flush cellular waste',
  'Deep Fast': 'Stay hydrated — your body is in deep repair',
};
