import React from 'react';
import { View, Text } from 'react-native';

interface WaterStatusBarProps {
  currentMl: number;
  goalMl: number;
}

export const WaterStatusBar = React.memo(function WaterStatusBar({ currentMl, goalMl }: WaterStatusBarProps) {
  return (
    <View className="bg-white rounded-2xl mx-6 mb-4 py-3 px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
      <Text className="text-text-primary text-center text-sm font-medium">
        {currentMl}ml drank{'  '}|{'  '}out of {goalMl}ml
      </Text>
    </View>
  );
});
