/** Quick-add water amounts in ml */
export const QUICK_ADD_AMOUNTS = [250, 500] as const;

/** Default daily water goal in ml */
export const DEFAULT_DAILY_WATER_GOAL_ML = 2000;

/** Min/max for daily goal stepper in ml */
export const MIN_DAILY_WATER_GOAL_ML = 500;
export const MAX_DAILY_WATER_GOAL_ML = 5000;
export const WATER_GOAL_STEP_ML = 250;

/** Add-water sheet stepper constants */
export const WATER_STEPPER_INCREMENT_ML = 50;
export const MIN_ADD_AMOUNT_ML = 50;
export const MAX_ADD_AMOUNT_ML = 1500;
export const DEFAULT_ADD_AMOUNT_ML = 250;

/**
 * Phase-aware hydration tips shown on the water screen.
 * Short header tip + warm subline per phase. Always visible — even when idle.
 */
export const PHASE_HYDRATION_TIPS: Record<string, { tip: string; subline: string }> = {
  'Fed State': {
    tip: 'water aids digestion',
    subline: 'Keep sipping — it helps the last meal settle.',
  },
  'Early Fasting': {
    tip: 'water calms the hunger',
    subline: 'Try a glass first — cravings often pass in minutes.',
  },
  'Fat Burning Begins': {
    tip: 'electrolytes help',
    subline: 'A pinch of salt steadies energy.',
  },
  'Fat Burning Peak': {
    tip: 'ketosis raises water loss',
    subline: 'Drink a little more than you think you need.',
  },
  'Autophagy Zone': {
    tip: 'electrolytes help',
    subline: 'A pinch of salt steadies energy.',
  },
  'Deep Fast': {
    tip: 'deep-repair hydration',
    subline: 'Stay steady — your body is doing careful work.',
  },
};

/** Short semantic label for a water log entry derived from ml amount. */
export function labelForWaterAmount(ml: number): string {
  if (ml <= 200) return 'Sip of water';
  if (ml <= 300) return 'Glass of water';
  if (ml <= 500) return 'Bottle of water';
  return 'Large bottle';
}
