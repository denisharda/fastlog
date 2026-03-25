import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { QUICK_ADD_AMOUNTS } from '../../constants/hydration';

const ICONS = ['🥤', '🫗'] as const;

interface QuickTapRowProps {
  onQuickAdd: (amountMl: number) => void;
  onToggleMore: () => void;
  moreExpanded: boolean;
}

export function QuickTapRow({ onQuickAdd, onToggleMore, moreExpanded }: QuickTapRowProps) {
  function handleQuickAdd(amount: number) {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onQuickAdd(amount);
  }

  return (
    <View className="flex-row gap-2.5">
      {QUICK_ADD_AMOUNTS.map((amount, i) => (
        <Pressable
          key={amount}
          className={`flex-1 h-[52px] rounded-2xl items-center justify-center active:scale-95 ${
            i === 0
              ? 'bg-water'
              : 'bg-white border-[1.5px] border-gray-200'
          }`}
          style={i === 0 ? { shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 } : undefined}
          onPress={() => handleQuickAdd(amount)}
          accessibilityLabel={`Add ${amount} milliliters`}
          accessibilityRole="button"
        >
          <Text className={`text-xs ${i === 0 ? 'text-white' : ''}`}>{ICONS[i]}</Text>
          <Text className={`font-bold text-[13px] ${i === 0 ? 'text-white' : 'text-text-primary'}`}>
            +{amount}ml
          </Text>
        </Pressable>
      ))}
      <Pressable
        className={`w-[52px] h-[52px] rounded-2xl items-center justify-center border-[1.5px] active:scale-95 ${
          moreExpanded ? 'bg-water/10 border-water' : 'bg-white border-gray-200'
        }`}
        onPress={onToggleMore}
        accessibilityLabel="Custom amount"
        accessibilityRole="button"
      >
        <Text className="text-[10px]">⚙️</Text>
        <Text className={`font-semibold text-[8px] ${moreExpanded ? 'text-water' : 'text-text-muted'}`}>
          More
        </Text>
      </Pressable>
    </View>
  );
}
