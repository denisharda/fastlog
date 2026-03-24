import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FastingPhase } from '../../constants/phases';

interface PhaseLabelProps {
  phase: FastingPhase;
  visible: boolean;
  onPress?: () => void;
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

/**
 * Displays the current fasting phase name and description below the ring.
 * Tappable to open the phases drawer. Light-theme card style.
 */
export const PhaseLabel = React.memo(function PhaseLabel({ phase, visible, onPress }: PhaseLabelProps) {
  if (!visible) return null;

  return (
    <Pressable className="items-center mt-6" onPress={onPress}>
      <View
        className="bg-white px-5 py-2.5 rounded-full mb-1 flex-row items-center gap-1"
        style={cardShadow}
      >
        <Text className="text-primary font-semibold text-sm">{phase.name}</Text>
        <Text className="text-gray-400 text-xs">&#x25B8;</Text>
      </View>
      <Text className="text-gray-500 text-xs text-center mt-1">{phase.description}</Text>
    </Pressable>
  );
}, (prev, next) => {
  return (
    prev.phase.name === next.phase.name &&
    prev.visible === next.visible &&
    prev.onPress === next.onPress
  );
});
