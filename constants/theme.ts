import type { ViewStyle, TextStyle } from 'react-native';

export type PhaseKey =
  | 'Fed State'
  | 'Early Fasting'
  | 'Fat Burning Begins'
  | 'Fat Burning Peak'
  | 'Autophagy Zone'
  | 'Deep Fast';

export interface PhaseDef {
  name: PhaseKey;
  short: string;
  range: string;
  start: number;
  end: number;
  description: string;
  science: string;
  tips: string[];
  metabolicMarkers: string;
}

export const PHASES: PhaseDef[] = [
  {
    name: 'Fed State',
    short: 'Fed',
    range: '0–4h',
    start: 0,
    end: 4,
    description: 'Body still processing last meal',
    science:
      'Insulin elevated, glucose absorbing, anabolic mode. Your body is actively breaking down and absorbing nutrients from your last meal.',
    tips: ['Stay hydrated', 'Avoid snacking to let digestion complete'],
    metabolicMarkers: 'Insulin high, blood glucose elevated, mTOR active',
  },
  {
    name: 'Early Fasting',
    short: 'Early',
    range: '4–8h',
    start: 4,
    end: 8,
    description: 'Insulin dropping',
    science:
      'Insulin levels begin to fall, blood sugar stabilizes. Your body starts transitioning from glucose metabolism to stored energy.',
    tips: ['Drink water or herbal tea', 'Stay busy to manage hunger cues'],
    metabolicMarkers: 'Insulin falling, glucagon rising, blood glucose normalizing',
  },
  {
    name: 'Fat Burning Begins',
    short: 'Burn · Start',
    range: '8–12h',
    start: 8,
    end: 12,
    description: 'Glycogen depleting',
    science:
      'Hepatic glycogen depleting, fatty acid oxidation rising. Your liver begins releasing stored glucose while fat cells start mobilizing.',
    tips: ['Water with electrolytes helps', 'Light walking boosts fat oxidation'],
    metabolicMarkers: 'Glycogen dropping, free fatty acids rising, growth hormone increasing',
  },
  {
    name: 'Fat Burning Peak',
    short: 'Burn · Peak',
    range: '12–16h',
    start: 12,
    end: 16,
    description: 'Ketosis starting',
    science:
      'Ketone production ramps up as your body enters ketosis. Fat is now a primary energy source, and mental clarity often improves.',
    tips: ['Black coffee or green tea are fine', 'Expect a mental clarity boost'],
    metabolicMarkers: 'Ketones rising (BHB 0.5-1.0 mM), insulin at baseline, HGH elevated',
  },
  {
    name: 'Autophagy Zone',
    short: 'Autophagy',
    range: '16–18h',
    start: 16,
    end: 18,
    description: 'Cellular cleanup',
    science:
      'AMPK activated, mTOR suppressed, cells recycling damaged proteins. Cellular cleanup accelerates with anti-aging and repair benefits.',
    tips: ['Black coffee enhances autophagy', 'Rest if you feel low energy'],
    metabolicMarkers: 'AMPK up, mTOR suppressed, autophagy markers elevated',
  },
  {
    name: 'Deep Fast',
    short: 'Deep',
    range: '18h+',
    start: 18,
    end: 24,
    description: 'Maximum benefits',
    science:
      'Maximum autophagy and fat oxidation. Your body is in a deep state of repair and regeneration. Inflammation markers typically decrease significantly.',
    tips: ['Listen to your body', 'Break fast gently with easily digestible food'],
    metabolicMarkers: 'Peak ketones (BHB 1.0-3.0 mM), inflammation markers low, deep autophagy',
  },
];

/** Phase-specific one-line subline for Timer info card. */
export const PHASE_SUBLINES: Record<PhaseKey, string> = {
  'Fed State': 'Digestion winding down',
  'Early Fasting': 'Body adapting',
  'Fat Burning Begins': 'Switching fuel sources',
  'Fat Burning Peak': "You're in deep fat-burn",
  'Autophagy Zone': 'Cellular repair active',
  'Deep Fast': 'Deep repair underway',
};

export function getCurrentPhase(elapsedHours: number): PhaseDef {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (elapsedHours >= PHASES[i].start) return PHASES[i];
  }
  return PHASES[0];
}

export function getPhaseIndex(elapsedHours: number): number {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (elapsedHours >= PHASES[i].start) return i;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Amber Sunrise palette — source of truth from design tokens.jsx
// ─────────────────────────────────────────────────────────────
export interface Theme {
  isDark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  textFaint: string;
  hairline: string;
  primary: string;
  primarySoft: string;
  accent: string;
  water: string;
  waterSoft: string;
  success: string;
  danger: string;
  phases: readonly [string, string, string, string, string, string];
}

const LIGHT: Theme = {
  isDark: false,
  bg: '#FBF6EE',
  surface: '#FFFFFF',
  surface2: '#F5EEE2',
  text: '#2A1F14',
  textMuted: '#6B5A44',
  textFaint: '#A8957A',
  hairline: 'rgba(42,31,20,0.08)',
  primary: '#C8621B',
  primarySoft: '#E89B5C',
  accent: '#D89B2B',
  water: '#5B9BB8',
  waterSoft: '#A8CCDA',
  success: '#5D8A6B',
  danger: '#B15548',
  phases: ['#E8C89A', '#E6A86B', '#D88845', '#C8621B', '#A04418', '#6B2A12'],
};

const DARK: Theme = {
  isDark: true,
  bg: '#17110A',
  surface: '#221A10',
  surface2: '#2B2115',
  text: '#FBF3E3',
  textMuted: '#C9B590',
  textFaint: '#7A6B54',
  hairline: 'rgba(251,243,227,0.10)',
  primary: '#E89B5C',
  primarySoft: '#C8621B',
  accent: '#EDBC52',
  water: '#7BB6D1',
  waterSoft: '#3A5F70',
  success: '#7CA689',
  danger: '#D37864',
  phases: ['#6B5232', '#9C7341', '#C8894A', '#E89B5C', '#F0B878', '#F8D9A8'],
};

export function resolveTheme(isDark: boolean): Theme {
  return isDark ? DARK : LIGHT;
}

export const THEME_LIGHT = LIGHT;
export const THEME_DARK = DARK;

// ─────────────────────────────────────────────────────────────
// Radii · Spacing (4pt base) · Typography
// ─────────────────────────────────────────────────────────────
export const RADII = {
  xs: 8,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Tabular numerals — use on every numeric display. */
export const TABULAR: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/** Legacy alias — kept so existing imports keep working. */
export const CARD_SHADOW: ViewStyle = {
  shadowColor: '#2A1F14',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 16,
  elevation: 2,
};

/** Standard light card shadow — matches design system card spec. */
export function cardShadow(theme: Theme): ViewStyle {
  if (theme.isDark) {
    return {
      shadowColor: '#000',
      shadowOpacity: 0,
      elevation: 0,
      borderWidth: 0.5,
      borderColor: theme.hairline,
    };
  }
  return {
    shadowColor: '#2A1F14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  };
}

/** Tinted button shadow — `0 6px 20px {color}55` in spec terms. */
export function buttonShadow(color: string): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.33,
    shadowRadius: 20,
    elevation: 6,
  };
}

/** Elevated card (paywall plan, fast-complete) — `0 10px 24px {primary}22`. */
export function elevatedShadow(color: string): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 6,
  };
}

/** Apply alpha to a hex color via hex suffix. value in 0-255. */
export function hexAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(255, Math.round(alpha)))
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
