import React from 'react';
import { View, Text } from 'react-native';

interface WaterStatusBarProps {
  currentMl: number;
  goalMl: number;
}

export const WaterStatusBar = React.memo(function WaterStatusBar({ currentMl, goalMl }: WaterStatusBarProps) {
  return (
    <View className="bg-black/40 rounded-2xl mx-6 mb-4 py-3 px-4">
      <Text className="text-text-primary text-center text-sm font-medium">
        {currentMl}ml drank{'  '}|{'  '}out of {goalMl}ml
      </Text>
    </View>
  );
});
