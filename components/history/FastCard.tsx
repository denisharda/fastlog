import React from 'react';
import { View, Text } from 'react-native';
import { FastingSession } from '../../types';

interface FastCardProps {
  session: FastingSession;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'In progress';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Card displaying a single fasting session summary.
 */
export const FastCard = React.memo(function FastCard({ session }: FastCardProps) {
  const duration = formatDuration(session.started_at, session.ended_at);
  const progress =
    session.ended_at
      ? Math.min(
          (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) /
            (session.target_hours * 3600000),
          1
        )
      : 0;

  return (
    <View className="bg-surface rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-text-primary font-semibold">{formatDate(session.started_at)}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-text-muted text-sm">{session.protocol}</Text>
          {session.completed && (
            <View className="bg-primary px-2 py-0.5 rounded-full">
              <Text className="text-text-primary text-xs">Complete</Text>
            </View>
          )}
        </View>
      </View>

      <Text className="text-accent font-bold text-xl mb-2">{duration}</Text>

      {/* Progress bar */}
      <View className="w-full h-1.5 bg-background rounded-full overflow-hidden">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </View>
      <Text className="text-text-muted text-xs mt-1">
        {Math.round(progress * 100)}% of {session.target_hours}h goal
      </Text>
    </View>
  );
});
