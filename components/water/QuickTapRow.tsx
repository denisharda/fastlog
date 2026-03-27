import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { QUICK_ADD_AMOUNTS } from '../../constants/hydration';

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
              ? 'bg-primary'
              : 'bg-white border-[1.5px] border-gray-200'
          }`}
          style={i === 0 ? { shadowColor: '#2D6A4F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 } : undefined}
          onPress={() => handleQuickAdd(amount)}
          accessibilityLabel={`Add ${amount} milliliters`}
          accessibilityRole="button"
        >
          <Text className={`font-bold text-[15px] ${i === 0 ? 'text-white' : 'text-text-primary'}`}>
            +{amount}ml
          </Text>
        </Pressable>
      ))}
      <Pressable
        className={`w-[52px] h-[52px] rounded-2xl items-center justify-center border-[1.5px] active:scale-95 ${
          moreExpanded ? 'bg-primary/10 border-primary' : 'bg-white border-gray-200'
        }`}
        onPress={onToggleMore}
        accessibilityLabel="Custom amount"
        accessibilityRole="button"
      >
        <Text className={`font-semibold text-[11px] ${moreExpanded ? 'text-primary' : 'text-text-muted'}`}>
          Custom
        </Text>
      </Pressable>
    </View>
  );
}
