import { View, Text } from 'react-native';
import { FastingPhase } from '../../constants/phases';

interface PhaseLabelProps {
  phase: FastingPhase;
  visible: boolean;
}

/**
 * Displays the current fasting phase name and description below the ring.
 */
export function PhaseLabel({ phase, visible }: PhaseLabelProps) {
  if (!visible) return null;

  return (
    <View className="items-center mt-6">
      <View className="bg-surface px-4 py-2 rounded-full mb-1">
        <Text className="text-accent font-semibold text-sm">{phase.name}</Text>
      </View>
      <Text className="text-text-muted text-xs text-center">{phase.description}</Text>
    </View>
  );
}
