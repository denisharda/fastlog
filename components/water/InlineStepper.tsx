import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MIN_ADD_AMOUNT_ML, MAX_ADD_AMOUNT_ML } from '../../constants/hydration';

interface InlineStepperProps {
  visible: boolean;
  onAdd: (amountMl: number) => void;
  onCollapse: () => void;
}

export function InlineStepper({ visible, onAdd, onCollapse }: InlineStepperProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  if (!visible) return null;

  const parsed = parseInt(text, 10);
  const isValid = !isNaN(parsed) && parsed >= MIN_ADD_AMOUNT_ML && parsed <= MAX_ADD_AMOUNT_ML;

  function handleAdd() {
    if (!isValid) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdd(parsed);
    setText('');
    onCollapse();
  }

  return (
    <View
      className="bg-white rounded-2xl p-3 border-[1.5px] border-gray-200 mt-2"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-center gap-2">
        <TextInput
          ref={inputRef}
          className="flex-1 h-11 bg-background rounded-xl px-3 text-text-primary text-[18px] font-bold"
          placeholder={`${MIN_ADD_AMOUNT_ML}–${MAX_ADD_AMOUNT_ML}ml`}
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          maxLength={4}
          accessibilityLabel="Custom water amount in milliliters"
        />
        <Text className="text-text-muted text-sm font-medium">ml</Text>
        <Pressable
          className={`h-11 px-5 rounded-xl items-center justify-center active:scale-[0.98] ${
            isValid ? 'bg-primary' : 'bg-gray-300'
          }`}
          onPress={handleAdd}
          disabled={!isValid}
          accessibilityRole="button"
        >
          <Text className={`font-semibold text-sm ${isValid ? 'text-white' : 'text-gray-500'}`}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}
