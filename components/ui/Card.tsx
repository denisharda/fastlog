import { View, ViewProps } from 'react-native';
import { Theme } from '../../constants/theme';
import { cardShadow } from '../../constants/theme';

interface CardProps extends ViewProps {
  theme: Theme;
  padding?: number;
  radius?: number;
}

/** Surface card — 20 radius, theme-aware shadow or hairline border in dark. */
export function Card({ theme, padding = 16, radius = 20, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: radius,
          padding,
          ...cardShadow(theme),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
