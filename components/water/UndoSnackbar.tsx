import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';

interface UndoSnackbarProps {
  message: string;
  visible: boolean;
  onUndo: () => void;
  onDismiss: () => void;
  /** Auto-dismiss timeout in ms (default 4000) */
  timeout?: number;
}

/**
 * Bottom snackbar with "Undo" action. Auto-dismisses after timeout.
 * Slides in from bottom with a spring animation.
 */
export function UndoSnackbar({
  message,
  visible,
  onUndo,
  onDismiss,
  timeout = 4000,
}: UndoSnackbarProps) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 15,
          stiffness: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        onDismiss();
      }, timeout);
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 80,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        position: 'absolute',
        bottom: 90,
        left: 24,
        right: 24,
        zIndex: 100,
      }}
    >
      <View className="bg-surface rounded-2xl px-4 py-3 flex-row items-center justify-between border border-primary/20">
        <Text className="text-text-primary text-sm flex-1">{message}</Text>
        <Pressable
          className="ml-3 px-3 py-1.5 rounded-lg"
          style={{ minHeight: 36 }}
          onPress={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            onUndo();
          }}
        >
          <Text className="text-accent font-bold text-sm">Undo</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
