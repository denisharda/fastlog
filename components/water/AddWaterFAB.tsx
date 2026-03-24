import React from 'react';
import { Pressable, Text, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface AddWaterFABProps {
  onPress: () => void;
}

export const AddWaterFAB = React.memo(function AddWaterFAB({ onPress }: AddWaterFABProps) {
  function handlePress() {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  }

  return (
    <Pressable
      className="absolute bottom-24 right-6 w-16 h-16 rounded-full bg-text-primary shadow-lg items-center justify-center active:scale-95"
      onPress={handlePress}
    >
      <Text className="text-white text-3xl font-bold">+</Text>
    </Pressable>
  );
});
