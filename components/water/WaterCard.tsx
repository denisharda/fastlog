import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { WaveGauge } from './WaveGauge';

const DRINK_OPTIONS = [
  { amount: 250, icon: '🥛', label: '250ml' },
  { amount: 500, icon: '🧴', label: '500ml' },
  { amount: 350, icon: '☕', label: '350ml' },
];

interface WaterCardProps {
  currentMl: number;
  goalMl: number;
  progressRatio: number;
  onAdd: (amountMl: number) => void;
  onSubtract: () => void;
}

/**
 * Compact water tracking card with wave gauge, quick-add buttons,
 * and tappable total for subtract/undo.
 */
export function WaterCard({ currentMl, goalMl, progressRatio, onAdd, onSubtract }: WaterCardProps) {
  function handleAdd(amount: number) {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdd(amount);
  }

  function formatLiters(ml: number): string {
    if (ml >= 1000) return `${(ml / 1000).toFixed(1)}L`;
    return `${ml}ml`;
  }

  return (
    <View className="w-full bg-surface rounded-2xl p-4">
      {/* Top row: gauge + stats */}
      <View className="flex-row items-center mb-3">
        <WaveGauge progress={progressRatio} size={60} />

        <View className="flex-1 ml-3">
          <View className="flex-row items-baseline">
            <Text className="text-text-primary text-lg font-bold">
              {formatLiters(currentMl)}
            </Text>
            <Text className="text-text-muted text-sm ml-1">
              / {formatLiters(goalMl)}
            </Text>
          </View>
          <Text className="text-text-muted text-xs mt-0.5">
            Daily hydration
          </Text>
        </View>

        {/* Subtract — visible when there's water logged */}
        {currentMl > 0 && (
          <Pressable
            className="w-9 h-9 rounded-full bg-background items-center justify-center active:scale-95"
            onPress={onSubtract}
            hitSlop={8}
          >
            <Text className="text-text-muted text-lg font-bold">−</Text>
          </Pressable>
        )}
      </View>

      {/* Quick-add buttons */}
      <View className="flex-row gap-2">
        {DRINK_OPTIONS.map((drink) => (
          <Pressable
            key={drink.amount}
            className="flex-1 flex-row items-center justify-center bg-background rounded-xl py-2.5 active:scale-95 border border-primary/20"
            style={{ minHeight: 44 }}
            onPress={() => handleAdd(drink.amount)}
          >
            <Text className="text-sm mr-1.5">{drink.icon}</Text>
            <Text className="text-text-primary text-sm font-medium">{drink.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
