import { useColorScheme } from 'react-native';
import { resolveTheme, Theme } from '../constants/theme';

/**
 * Returns the resolved Amber Sunrise theme for the current system color scheme.
 * Components use this for theme-aware inline colors; NativeWind handles layout.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return resolveTheme(scheme === 'dark');
}
