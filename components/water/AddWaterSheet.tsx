import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  WATER_STEPPER_INCREMENT_ML,
  MIN_ADD_AMOUNT_ML,
  MAX_ADD_AMOUNT_ML,
  DEFAULT_ADD_AMOUNT_ML,
} from '../../constants/hydration';

const QUICK_ADD_OPTIONS = [100, 250, 500, 750] as const;
const SLIDER_TRACK_HORIZONTAL_PADDING = 24;

interface AddWaterSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (amountMl: number) => void;
}

export function AddWaterSheet({ visible, onClose, onAdd }: AddWaterSheetProps) {
  const [selectedAmount, setSelectedAmount] = useState(DEFAULT_ADD_AMOUNT_ML);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Slider state
  const trackWidth = useRef(0);
  const thumbX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedAmount(DEFAULT_ADD_AMOUNT_ML);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Sync thumb position when amount changes via stepper or quick-add
  useEffect(() => {
    if (trackWidth.current > 0) {
      const ratio =
        (selectedAmount - MIN_ADD_AMOUNT_ML) /
        (MAX_ADD_AMOUNT_ML - MIN_ADD_AMOUNT_ML);
      thumbX.setValue(ratio * trackWidth.current);
    }
  }, [selectedAmount]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        updateFromGesture(gestureState.x0);
      },
      onPanResponderMove: (_, gestureState) => {
        updateFromGesture(gestureState.moveX);
      },
    })
  ).current;

  const trackLayoutRef = useRef({ x: 0, width: 0 });

  function updateFromGesture(pageX: number) {
    const { x, width } = trackLayoutRef.current;
    if (width === 0) return;
    const relativeX = Math.max(0, Math.min(pageX - x, width));
    const ratio = relativeX / width;
    const rawMl = MIN_ADD_AMOUNT_ML + ratio * (MAX_ADD_AMOUNT_ML - MIN_ADD_AMOUNT_ML);
    const snapped =
      Math.round(rawMl / WATER_STEPPER_INCREMENT_ML) * WATER_STEPPER_INCREMENT_ML;
    const clamped = Math.max(MIN_ADD_AMOUNT_ML, Math.min(MAX_ADD_AMOUNT_ML, snapped));
    setSelectedAmount(clamped);
    thumbX.setValue(relativeX);
  }

  function increment() {
    setSelectedAmount((prev) =>
      Math.min(prev + WATER_STEPPER_INCREMENT_ML, MAX_ADD_AMOUNT_ML)
    );
  }

  function decrement() {
    setSelectedAmount((prev) =>
      Math.max(prev - WATER_STEPPER_INCREMENT_ML, MIN_ADD_AMOUNT_ML)
    );
  }

  function handleAdd() {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onAdd(selectedAmount);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Overlay */}
      <Animated.View
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlayOpacity }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: slideAnim }],
          backgroundColor: '#1A1A1A',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 40,
        }}
      >
        {/* Drag handle */}
        <View className="items-center pt-3 pb-2">
          <View className="w-10 h-1 rounded-full bg-text-muted/40" />
        </View>

        <Text className="text-text-primary text-lg font-bold text-center mb-4">
          Add Water
        </Text>

        {/* Stepper row */}
        <View className="flex-row items-center justify-center gap-6 mb-6 px-6">
          <Pressable
            className="w-12 h-12 rounded-full bg-surface items-center justify-center active:scale-95"
            onPress={decrement}
          >
            <Text className="text-text-primary text-2xl font-bold">−</Text>
          </Pressable>
          <Text className="text-text-primary text-3xl font-bold min-w-[120px] text-center">
            {selectedAmount}ml
          </Text>
          <Pressable
            className="w-12 h-12 rounded-full bg-surface items-center justify-center active:scale-95"
            onPress={increment}
          >
            <Text className="text-text-primary text-2xl font-bold">+</Text>
          </Pressable>
        </View>

        {/* Slider */}
        <View
          className="mx-6 mb-6 h-10 justify-center"
          onLayout={(e) => {
            trackLayoutRef.current = {
              x: e.nativeEvent.layout.x + SLIDER_TRACK_HORIZONTAL_PADDING,
              width: e.nativeEvent.layout.width,
            };
            trackWidth.current = e.nativeEvent.layout.width;
            // Set initial thumb position
            const ratio =
              (selectedAmount - MIN_ADD_AMOUNT_ML) /
              (MAX_ADD_AMOUNT_ML - MIN_ADD_AMOUNT_ML);
            thumbX.setValue(ratio * e.nativeEvent.layout.width);
          }}
          {...panResponder.panHandlers}
        >
          {/* Track background */}
          <View className="h-1.5 rounded-full bg-surface" />
          {/* Track fill */}
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#0EA5E9',
              width: thumbX,
            }}
          />
          {/* Thumb */}
          <Animated.View
            style={{
              position: 'absolute',
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#0EA5E9',
              marginLeft: -12,
              transform: [{ translateX: thumbX }],
            }}
          />
        </View>

        {/* Quick-add pills */}
        <View className="flex-row gap-2 px-6 mb-6 justify-center">
          {QUICK_ADD_OPTIONS.map((amount) => (
            <Pressable
              key={amount}
              className={`px-4 py-2.5 rounded-full border ${
                selectedAmount === amount
                  ? 'bg-water/20 border-water'
                  : 'bg-surface border-transparent'
              }`}
              onPress={() => setSelectedAmount(amount)}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedAmount === amount ? 'text-water' : 'text-text-muted'
                }`}
              >
                +{amount}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Add button */}
        <View className="px-6">
          <Pressable
            className="bg-primary rounded-2xl py-4 items-center active:scale-[0.98]"
            onPress={handleAdd}
          >
            <Text className="text-text-primary text-base font-bold">
              Add {selectedAmount}ml
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}
