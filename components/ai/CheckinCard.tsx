import { View, Text } from 'react-native';
import { Checkin } from '../../types';
import { COACHES } from '../../constants/coaches';

interface CheckinCardProps {
  checkin: Checkin;
}

/**
 * Displays a single AI check-in message with coach branding.
 */
export function CheckinCard({ checkin }: CheckinCardProps) {
  const coach = COACHES[checkin.personality];

  return (
    <View className="bg-surface rounded-2xl p-4 border border-primary/20">
      {/* Coach header */}
      <View className="flex-row items-center mb-3">
        <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2">
          <Text className="text-sm">{coach.emoji}</Text>
        </View>
        <View>
          <Text className="text-text-primary font-semibold text-sm">{coach.label} Coach</Text>
          <Text className="text-text-muted text-xs">Hour {checkin.fasting_hour}</Text>
        </View>
      </View>

      {/* Message */}
      <Text className="text-text-primary text-base leading-relaxed">{checkin.message}</Text>
    </View>
  );
}
