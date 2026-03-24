import React from 'react';
import { View, Text } from 'react-native';

interface WaterPercentCircleProps {
  progressRatio: number;
  remainingMl: number;
}

export const WaterPercentCircle = React.memo(function WaterPercentCircle({ progressRatio, remainingMl }: WaterPercentCircleProps) {
  const pct = Math.round(Math.min(progressRatio, 1) * 100);
  const goalReached = progressRatio >= 1;

  return (
    <View className="w-48 h-48 rounded-full bg-white items-center justify-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }}>
      {goalReached ? (
        <>
          <Text className="text-text-primary text-4xl font-bold">✓</Text>
          <Text className="text-text-muted text-sm mt-1">Goal reached!</Text>
        </>
      ) : (
        <>
          <Text className="text-text-primary text-5xl font-bold">{pct}%</Text>
          <Text className="text-text-muted text-sm mt-1">
            {remainingMl}ml left
          </Text>
        </>
      )}
    </View>
  );
});
