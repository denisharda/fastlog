import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Keyboard } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { MIN_ADD_AMOUNT_ML, MAX_ADD_AMOUNT_ML } from '../../constants/hydration';
import { useTheme } from '../../hooks/useTheme';

interface CustomAmountSheetProps {
  visible: boolean;
  onAdd: (amountMl: number) => void;
  onClose: () => void;
}

export function CustomAmountSheet({ visible, onAdd, onClose }: CustomAmountSheetProps) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      sheetRef.current?.present();
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const parsed = parseInt(text, 10);
  const isValid = !isNaN(parsed) && parsed >= MIN_ADD_AMOUNT_ML && parsed <= MAX_ADD_AMOUNT_ML;

  function handleAdd() {
    if (!isValid) return;
    onAdd(parsed);
    Keyboard.dismiss();
    onClose();
  }

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />
    ),
    [],
  );

  const snapPoints = useMemo(() => ['30%'], []);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
      handleIndicatorStyle={{ backgroundColor: theme.hairline, width: 40, height: 4 }}
    >
      <BottomSheetView style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
        <Text
          style={{
            fontSize: 19,
            fontWeight: '700',
            color: theme.text,
            letterSpacing: -0.3,
            marginBottom: 14,
          }}
        >
          Custom amount
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              backgroundColor: theme.surface2,
              borderWidth: 1.5,
              borderColor: isValid ? theme.primary : theme.hairline,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextInput
              ref={inputRef}
              placeholder={`${MIN_ADD_AMOUNT_ML}–${MAX_ADD_AMOUNT_ML}`}
              placeholderTextColor={theme.textFaint}
              keyboardType="number-pad"
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              maxLength={4}
              accessibilityLabel="Custom water amount in milliliters"
              style={{
                flex: 1,
                fontSize: 17,
                fontWeight: '600',
                color: theme.text,
                letterSpacing: -0.2,
                paddingVertical: 0,
              }}
            />
            <Text style={{ color: theme.textFaint, fontSize: 14, fontWeight: '500' }}>ml</Text>
          </View>
          <Pressable
            onPress={handleAdd}
            disabled={!isValid}
            style={{
              height: 54,
              paddingHorizontal: 22,
              borderRadius: 16,
              backgroundColor: isValid ? theme.water : theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isValid ? 1 : 0.6,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: isValid ? '#FFFFFF' : theme.textFaint,
                letterSpacing: -0.1,
              }}
            >
              Add
            </Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 12, color: theme.textFaint, marginTop: 10, paddingLeft: 4 }}>
          Between {MIN_ADD_AMOUNT_ML} and {MAX_ADD_AMOUNT_ML} ml.
        </Text>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
