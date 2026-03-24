import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface TimerControlsProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onComplete: () => void;
  progressRatio: number;
}

const buttonShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 3,
};

/**
 * Start / stop / complete button group for the timer screen.
 * Light theme: black start button, green complete, white+red-border stop.
 */
export const TimerControls = React.memo(function TimerControls({
  isActive,
  onStart,
  onStop,
  onComplete,
  progressRatio,
}: TimerControlsProps) {
  if (!isActive) {
    return (
      <View className="w-full">
        <Pressable
          className="w-full bg-black py-4 rounded-2xl items-center"
          style={buttonShadow}
          onPress={onStart}
        >
          <Text className="text-white font-bold text-lg">Start Fast</Text>
        </Pressable>
      </View>
    );
  }

  const isNearComplete = progressRatio >= 0.9;

  return (
    <View className="w-full gap-3">
      {isNearComplete && (
        <Pressable
          className="w-full bg-primary py-4 rounded-2xl items-center"
          style={buttonShadow}
          onPress={onComplete}
        >
          <Text className="text-white font-bold text-lg">Complete Fast</Text>
        </Pressable>
      )}

      <Pressable
        className="w-full bg-white border border-red-300 py-4 rounded-2xl items-center"
        style={buttonShadow}
        onPress={onStop}
      >
        <Text className="text-red-500 font-semibold text-lg">
          {isNearComplete ? 'End Early' : 'Stop Fast'}
        </Text>
      </Pressable>
    </View>
  );
});
