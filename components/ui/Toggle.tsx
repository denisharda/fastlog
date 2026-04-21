import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../constants/theme';

interface ToggleProps {
  theme: Theme;
  on: boolean;
  onChange?: (on: boolean) => void;
}

/** 46x28 iOS-style toggle with animated knob. */
export function Toggle({ theme, on, onChange }: ToggleProps) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: on ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [on, anim]);

  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 20] });
  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.surface2, theme.primary],
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onChange?.(!on);
      }}
      hitSlop={6}
    >
      <Animated.View
        style={{
          width: 46,
          height: 28,
          borderRadius: 14,
          backgroundColor: bg,
          borderWidth: on ? 0 : 1,
          borderColor: theme.hairline,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 2,
            left,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
