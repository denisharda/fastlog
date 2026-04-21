import { Pressable, View, ViewStyle, StyleProp } from 'react-native';
import { Theme } from '../../constants/theme';

interface CircleIconProps {
  theme: Theme;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Override background — defaults to theme.surface. */
  background?: string;
  children: React.ReactNode;
}

/** Circular icon button — e.g. header close / export buttons. */
export function CircleIcon({ theme, size = 36, onPress, style, background, children }: CircleIconProps) {
  const content = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background ?? theme.surface,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#2A1F14',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: theme.isDark ? 0 : 0.06,
          shadowRadius: 2,
          elevation: theme.isDark ? 0 : 1,
          borderWidth: theme.isDark ? 0.5 : 0,
          borderColor: theme.hairline,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}
