import { useRef } from 'react';
import { Animated, Pressable, Text, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Theme, buttonShadow } from '../../constants/theme';

interface PrimaryButtonProps {
  theme: Theme;
  /** Override background color — defaults to theme.primary. */
  color?: string;
  /** Label text color — defaults to white. */
  textColor?: string;
  children: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Primary CTA — 56h, 18 radius, tinted shadow matching button color.
 * Uses an Animated.View wrapper for press scale so NativeWind doesn't drop
 * the static style by intercepting Pressable's function-style prop.
 */
export function PrimaryButton({
  theme,
  color,
  textColor = '#FFFFFF',
  children,
  onPress,
  disabled,
  loading,
  style,
}: PrimaryButtonProps) {
  const bg = color ?? theme.primary;
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      speed: 30,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale }],
          borderRadius: 18,
          ...buttonShadow(bg),
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        onPress={() => {
          if (disabled || loading) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress?.();
        }}
        disabled={disabled || loading}
        style={{
          width: '100%',
          height: 56,
          borderRadius: 18,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Text
            style={{
              color: textColor,
              fontSize: 17,
              fontWeight: '600',
              letterSpacing: -0.2,
            }}
          >
            {children}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
