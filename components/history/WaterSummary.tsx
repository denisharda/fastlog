import { View, Text } from 'react-native';

interface WaterSummaryProps {
  totalMl: number;
}

export function WaterSummary({ totalMl }: WaterSummaryProps) {
  if (totalMl <= 0) return null;

  return (
    <View className="bg-surface rounded-2xl p-4 flex-row items-center">
      <Text className="text-xl mr-3">💧</Text>
      <View>
        <Text className="text-text-primary font-semibold text-sm">Water Intake</Text>
        <Text className="text-text-muted text-xs">{totalMl.toLocaleString()} ml</Text>
      </View>
    </View>
  );
}
