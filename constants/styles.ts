import { ViewStyle } from 'react-native';

/** Standard card shadow used across the app */
export const CARD_SHADOW: ViewStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

/** Design system colors matching tailwind.config.js */
export const COLORS = {
  primary: '#2D6A4F',
  accent: '#40916C',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  borderLight: '#D1D5DB',
} as const;
