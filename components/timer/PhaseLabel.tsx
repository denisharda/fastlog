import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FastingPhase } from '../../constants/phases';

interface PhaseLabelProps {
  phase: FastingPhase;
  visible: boolean;
  onPress?: () => void;
}

/**
 * Displays the current fasting phase name and description below the ring.
 * Tappable to open the phases drawer.
 */
export const PhaseLabel = React.memo(function PhaseLabel({ phase, visible, onPress }: PhaseLabelProps) {
  if (!visible) return null;

  return (
    <Pressable className="items-center mt-6" onPress={onPress}>
      <View className="bg-surface px-4 py-2 rounded-full mb-1 flex-row items-center gap-1">
        <Text className="text-accent font-semibold text-sm">{phase.name}</Text>
        <Text className="text-text-muted text-xs">&#x25B8;</Text>
      </View>
      <Text className="text-text-muted text-xs text-center">{phase.description}</Text>
    </Pressable>
  );
}, (prev, next) => {
  return (
    prev.phase.name === next.phase.name &&
    prev.visible === next.visible &&
    prev.onPress === next.onPress
  );
});
