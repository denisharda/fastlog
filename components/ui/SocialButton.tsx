import { useRef } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Theme } from '../../constants/theme';

interface SocialButtonProps {
  theme: Theme;
  provider: 'apple' | 'google';
  onPress?: () => void;
  loading?: boolean;
}

/** 54px auth social button — Apple black/white, Google white with G logo. */
export function SocialButton({ theme, provider, onPress, loading }: SocialButtonProps) {
  const label = provider === 'apple' ? 'Continue with Apple' : 'Continue with Google';
  const bg = provider === 'apple' ? (theme.isDark ? '#FFFFFF' : '#000000') : theme.surface;
  const fg = provider === 'apple' ? (theme.isDark ? '#000000' : '#FFFFFF') : theme.text;
  const showGoogleShadow = provider === 'google' && !theme.isDark;
  const showGoogleBorder = provider === 'google' && theme.isDark;

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
      style={{
        transform: [{ scale }],
        borderRadius: 16,
        shadowColor: '#2A1F14',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: showGoogleShadow ? 0.08 : 0,
        shadowRadius: 3,
        elevation: showGoogleShadow ? 1 : 0,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={loading}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        accessibilityRole="button"
        style={{
          height: 54,
          borderRadius: 16,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: showGoogleBorder ? 1 : 0,
          borderColor: theme.hairline,
          paddingHorizontal: 16,
        }}
      >
        {provider === 'apple' ? (
          <Svg width={18} height={18} viewBox="0 0 18 18" style={{ marginRight: 10 }}>
            <Path
              fill={fg}
              d="M13.1 9.4c0-1.7 1-2.7 1.1-2.8-.6-.9-1.5-1-1.9-1-.8-.1-1.6.5-2 .5-.4 0-1.1-.5-1.8-.5-.9 0-1.8.5-2.3 1.4-1 1.7-.2 4.2.7 5.6.5.7 1 1.4 1.7 1.4.7 0 1-.4 1.8-.4.8 0 1.1.4 1.8.4.8 0 1.3-.7 1.7-1.4.5-.8.8-1.6.8-1.6s-1.6-.6-1.6-2.6zM11.8 4.4c.4-.4.6-1.1.6-1.7 0 0-.5 0-1.1.4-.5.3-.9.9-.9 1.5 0 0 .5 0 1.1-.4.1 0 .2-.1.3-.2z"
            />
          </Svg>
        ) : (
          <Svg width={18} height={18} viewBox="0 0 18 18" style={{ marginRight: 10 }}>
            <Path
              d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8c-.2 1.1-.8 2-1.8 2.6v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.4z"
              fill="#4285F4"
            />
            <Path
              d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3C2.4 15.9 5.5 18 9 18z"
              fill="#34A853"
            />
            <Path
              d="M3.9 10.7c-.2-.5-.3-1.1-.3-1.7 0-.6.1-1.2.3-1.7V5H.9C.3 6.2 0 7.6 0 9s.3 2.8.9 4l3-2.3z"
              fill="#FBBC04"
            />
            <Path
              d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3C13.5.9 11.4 0 9 0 5.5 0 2.4 2.1.9 5l3 2.3c.7-2.2 2.7-3.7 5.1-3.7z"
              fill="#EA4335"
            />
          </Svg>
        )}
        <Text
          style={{
            color: fg,
            fontSize: 15,
            fontWeight: '600',
            letterSpacing: -0.2,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
