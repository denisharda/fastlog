import { useState, useEffect } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  WATER_STEPPER_INCREMENT_ML,
  MIN_ADD_AMOUNT_ML,
  MAX_ADD_AMOUNT_ML,
  DEFAULT_ADD_AMOUNT_ML,
} from '../../constants/hydration';

interface InlineStepperProps {
  visible: boolean;
  onAdd: (amountMl: number) => void;
  onCollapse: () => void;
}

export function InlineStepper({ visible, onAdd, onCollapse }: InlineStepperProps) {
  const [amount, setAmount] = useState(DEFAULT_ADD_AMOUNT_ML);

  // Reset amount when stepper is re-opened
  useEffect(() => {
    if (visible) {
      setAmount(DEFAULT_ADD_AMOUNT_ML);
    }
  }, [visible]);

  if (!visible) return null;

  function increment() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAmount((prev) => Math.min(prev + WATER_STEPPER_INCREMENT_ML, MAX_ADD_AMOUNT_ML));
  }

  function decrement() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAmount((prev) => Math.max(prev - WATER_STEPPER_INCREMENT_ML, MIN_ADD_AMOUNT_ML));
  }

  function handleAdd() {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdd(amount);
    setAmount(DEFAULT_ADD_AMOUNT_ML);
    onCollapse();
  }

  return (
    <View
      className="bg-white rounded-2xl p-3 border-[1.5px] border-gray-200 mt-2"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-center justify-center gap-4">
        <Pressable
          className="w-9 h-9 rounded-full bg-background items-center justify-center active:scale-95"
          onPress={decrement}
          accessibilityLabel="Decrease amount"
          accessibilityRole="button"
        >
          <Text className="text-text-primary text-lg font-medium">−</Text>
        </Pressable>
        <Text className="text-text-primary text-[22px] font-bold min-w-[70px] text-center">
          {amount}ml
        </Text>
        <Pressable
          className="w-9 h-9 rounded-full bg-background items-center justify-center active:scale-95"
          onPress={increment}
          accessibilityLabel="Increase amount"
          accessibilityRole="button"
        >
          <Text className="text-text-primary text-lg font-medium">+</Text>
        </Pressable>
      </View>
      <Pressable
        className="bg-primary rounded-xl h-11 items-center justify-center mt-2 active:scale-[0.98]"
        onPress={handleAdd}
        accessibilityRole="button"
      >
        <Text className="text-white font-semibold text-sm">Add {amount}ml</Text>
      </Pressable>
    </View>
  );
}
