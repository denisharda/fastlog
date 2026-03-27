import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { MIN_ADD_AMOUNT_ML, MAX_ADD_AMOUNT_ML } from '../../constants/hydration';

interface CustomAmountSheetProps {
  visible: boolean;
  onAdd: (amountMl: number) => void;
  onClose: () => void;
}

export function CustomAmountSheet({ visible, onAdd, onClose }: CustomAmountSheetProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  const parsed = parseInt(text, 10);
  const isValid = !isNaN(parsed) && parsed >= MIN_ADD_AMOUNT_ML && parsed <= MAX_ADD_AMOUNT_ML;

  function handleAdd() {
    if (!isValid) return;
    onAdd(parsed);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end' }} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl px-6 pt-6 pb-10"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mb-4" />
            <Text className="text-text-primary text-lg font-bold mb-4">Custom Amount</Text>

            <View className="flex-row items-center gap-3">
              <TextInput
                ref={inputRef}
                className="flex-1 h-12 bg-background rounded-xl px-4 text-text-primary text-lg font-bold"
                placeholder={`${MIN_ADD_AMOUNT_ML}–${MAX_ADD_AMOUNT_ML}`}
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={text}
                onChangeText={setText}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
                maxLength={4}
              />
              <Text className="text-text-muted text-sm font-medium">ml</Text>
              <Pressable
                className={`h-12 px-6 rounded-full items-center justify-center ${
                  isValid ? 'bg-primary' : 'bg-gray-200'
                }`}
                onPress={handleAdd}
                disabled={!isValid}
              >
                <Text className={`font-bold text-sm ${isValid ? 'text-white' : 'text-gray-400'}`}>
                  Add
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
