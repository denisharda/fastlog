import { View, Text } from 'react-native';
import { Checkin } from '../../types';
import { COACHES } from '../../constants/coaches';
import { getCurrentPhase } from '../../constants/phases';

interface CheckinCardProps {
  checkin: Checkin;
}

/**
 * Displays a single AI check-in message with coach branding,
 * phase badge, and metabolic markers.
 */
export function CheckinCard({ checkin }: CheckinCardProps) {
  const coach = COACHES[checkin.personality];
  const phase = getCurrentPhase(checkin.fasting_hour);

  return (
    <View className="bg-surface rounded-2xl p-4 border border-primary/20">
      {/* Coach header */}
      <View className="flex-row items-center mb-3">
        <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2">
          <Text className="text-sm">{coach.emoji}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-text-primary font-semibold text-sm">{coach.label} Coach</Text>
          <Text className="text-text-muted text-xs">Hour {checkin.fasting_hour}</Text>
        </View>
        {/* Phase pill badge */}
        <View className="bg-primary/20 px-2.5 py-1 rounded-full">
          <Text className="text-accent text-xs font-medium">{phase.name}</Text>
        </View>
      </View>

      {/* Message */}
      <Text className="text-text-primary text-base leading-relaxed">{checkin.message}</Text>

      {/* Metabolic markers */}
      <Text className="text-text-muted text-xs italic mt-2">{phase.metabolicMarkers}</Text>
    </View>
  );
}
