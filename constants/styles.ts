/**
 * Legacy style re-exports. Prefer `useTheme()` and the helpers in ./theme
 * (cardShadow, buttonShadow, elevatedShadow) in new code.
 */
export {
  CARD_SHADOW,
  cardShadow,
  buttonShadow,
  elevatedShadow,
  hexAlpha,
  RADII,
  SPACING,
  TABULAR,
} from './theme';

/** @deprecated Use `useTheme()` + `theme.*` tokens instead. */
export const COLORS = {
  primary: '#C8621B',
  accent: '#D89B2B',
  background: '#FBF6EE',
  surface: '#FFFFFF',
  textPrimary: '#2A1F14',
  textMuted: '#6B5A44',
  border: 'rgba(42,31,20,0.08)',
  borderLight: 'rgba(42,31,20,0.12)',
} as const;
