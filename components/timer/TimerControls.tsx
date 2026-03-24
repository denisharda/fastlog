import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface TimerControlsProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onComplete: () => void;
  progressRatio: number;
}

/**
 * Start / stop / complete button group for the timer screen.
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
          className="w-full bg-primary py-5 rounded-2xl items-center"
          onPress={onStart}
        >
          <Text className="text-text-primary font-bold text-xl">Start Fast</Text>
        </Pressable>
      </View>
    );
  }

  const isNearComplete = progressRatio >= 0.9;

  return (
    <View className="w-full gap-3">
      {isNearComplete && (
        <Pressable
          className="w-full bg-primary py-5 rounded-2xl items-center"
          onPress={onComplete}
        >
          <Text className="text-text-primary font-bold text-xl">Complete Fast</Text>
        </Pressable>
      )}

      <Pressable
        className={`w-full border py-4 rounded-2xl items-center ${
          isNearComplete ? 'border-surface' : 'border-red-800'
        }`}
        onPress={onStop}
      >
        <Text
          className={`font-semibold text-lg ${isNearComplete ? 'text-text-muted' : 'text-red-400'}`}
        >
          {isNearComplete ? 'End Early' : 'Stop Fast'}
        </Text>
      </Pressable>
    </View>
  );
});
