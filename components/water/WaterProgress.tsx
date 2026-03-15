import { View, Text } from 'react-native';

interface WaterProgressProps {
  currentMl: number;
  goalMl: number;
  progressRatio: number;
}

export function WaterProgress({ currentMl, goalMl, progressRatio }: WaterProgressProps) {
  return (
    <View className="w-full">
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-text-muted text-xs">Water</Text>
        <Text className="text-text-muted text-xs">
          {currentMl.toLocaleString()} / {goalMl.toLocaleString()} ml
        </Text>
      </View>
      <View className="h-1.5 rounded-full bg-surface overflow-hidden">
        <View
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(progressRatio * 100, 100)}%` }}
        />
      </View>
    </View>
  );
}
