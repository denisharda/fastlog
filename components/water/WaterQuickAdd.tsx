import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { QUICK_ADD_AMOUNTS } from '../../constants/hydration';

interface WaterQuickAddProps {
  onAdd: (amountMl: number) => void;
}

export function WaterQuickAdd({ onAdd }: WaterQuickAddProps) {
  function handlePress(amount: number) {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdd(amount);
  }

  return (
    <View className="flex-row gap-2 justify-center">
      {QUICK_ADD_AMOUNTS.map((amount) => (
        <Pressable
          key={amount}
          className="bg-surface px-4 py-2.5 rounded-full min-w-[72px] items-center active:scale-95"
          style={{ minHeight: 44 }}
          onPress={() => handlePress(amount)}
        >
          <Text className="text-text-primary font-medium text-sm">+{amount}ml</Text>
        </Pressable>
      ))}
    </View>
  );
}
