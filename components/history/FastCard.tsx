import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FastingSession } from '../../types';
import { getCurrentPhase } from '../../constants/phases';

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

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
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
 * Tappable to expand a detail section with start/end times and phase reached.
 */
export function FastCard({ session }: FastCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = !session.ended_at;

  // Live tick for in-progress sessions
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isInProgress) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isInProgress]);

  const endTime = session.ended_at ? new Date(session.ended_at).getTime() : now;
  const elapsedMs = endTime - new Date(session.started_at).getTime();
  const elapsedHours = elapsedMs / 3600000;

  const duration = isInProgress
    ? formatDuration(session.started_at, new Date(now).toISOString())
    : formatDuration(session.started_at, session.ended_at);

  const progress = Math.min(elapsedMs / (session.target_hours * 3600000), 1);

  const phase = getCurrentPhase(elapsedHours);

  function handlePress() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((prev) => !prev);
  }

  return (
    <Pressable
      onPress={handlePress}
      className="bg-white rounded-2xl p-4"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-text-primary font-semibold">{formatDate(session.started_at)}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-text-muted text-sm">{session.protocol}</Text>
          {session.completed ? (
            <View className="bg-primary px-2 py-0.5 rounded-full">
              <Text className="text-white text-xs">Complete</Text>
            </View>
          ) : isInProgress ? (
            <View className="bg-accent/20 px-2 py-0.5 rounded-full">
              <Text className="text-accent text-xs font-medium">Live</Text>
            </View>
          ) : null}
          <Text className="text-text-muted text-base">{expanded ? '▾' : '▸'}</Text>
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

      {expanded && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <View className="flex-row justify-between mb-2">
            <View>
              <Text className="text-text-muted text-xs">Started</Text>
              <Text className="text-text-primary text-sm font-medium">
                {formatTime(session.started_at)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-text-muted text-xs">Ended</Text>
              <Text className="text-text-primary text-sm font-medium">
                {session.ended_at ? formatTime(session.ended_at) : 'In progress'}
              </Text>
            </View>
          </View>
          <View className="mb-1">
            <Text className="text-text-muted text-xs">Phase Reached</Text>
            <Text className="text-accent text-sm font-semibold">{phase.name}</Text>
            <Text className="text-text-muted text-xs">{phase.description}</Text>
          </View>
          {session.notes && (
            <Text className="text-text-muted text-sm italic mt-1">{session.notes}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
