import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface GoalCelebrationProps {
  visible: boolean;
}

export function GoalCelebration({ visible }: GoalCelebrationProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (visible && !hasTriggered.current) {
      hasTriggered.current = true;

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            tension: 50,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1500),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (!visible) {
      hasTriggered.current = false;
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
        },
      ]}
    >
      <Animated.Text
        style={{
          fontSize: 80,
          transform: [{ scale }],
        }}
      >
        💧
      </Animated.Text>
    </Animated.View>
  );
}
