import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { FastingSession } from '../../types';
import { getCurrentPhase } from '../../constants/phases';
import { CARD_SHADOW } from '../../constants/styles';
import { useNow } from '../../hooks/useNow';
import { useDailyHydration } from '../../hooks/useDailyHydration';
import { useHydration } from '../../hooks/useHydration';
import { trackPaywallViewed, trackShareSession } from '../../lib/posthog';
import { shareSession } from '../../lib/shareSession';

interface SessionDetailDrawerProps {
  visible: boolean;
  sessions: FastingSession[];
  onClose: () => void;
  onEndSession?: (sessionId: string, completed: boolean) => void;
  date?: string | null;
  isPro?: boolean;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function SessionDetailDrawer({ visible, sessions, onClose, onEndSession, date, isPro }: SessionDetailDrawerProps) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [phaseExpanded, setPhaseExpanded] = useState(false);

  // Reset selection when sessions change
  useEffect(() => {
    setSelectedIndex(0);
    setPhaseExpanded(false);
  }, [sessions]);

  const session = sessions[selectedIndex];
  const isInProgress = session && !session.ended_at;

  const now = useNow(visible && !!isInProgress);

  const { logs: hydrationLogs, totalMl: dayWaterMl, logCount: waterLogCount, isLoading: waterLoading } = useDailyHydration(date ?? null);
  const { dailyGoalMl } = useHydration();

  const hasSessions = sessions.length > 0 && !!session;

  if (!hasSessions && !date) return null;

  const endTime = session ? (session.ended_at ? new Date(session.ended_at).getTime() : now) : 0;
  const elapsedMs = session ? endTime - new Date(session.started_at).getTime() : 0;
  const elapsedHours = elapsedMs / 3600000;
  const progress = session ? Math.min(elapsedMs / (session.target_hours * 3600000), 1) : 0;
  const phase = getCurrentPhase(elapsedHours);

  const hydrationDateLabel = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const hydrationProgress = dailyGoalMl > 0 ? Math.min(dayWaterMl / dailyGoalMl, 1) : 0;

  function handleSessionSwitch(index: number) {
    Haptics.selectionAsync();
    setSelectedIndex(index);
    setPhaseExpanded(false);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
          <Text className="text-text-primary text-xl font-bold">
            {hasSessions ? 'Session Details' : 'Daily Summary'}
          </Text>
          <Pressable
            onPress={onClose}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel="Close session details"
          >
            <Text className="text-text-muted text-lg">Done</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
          {hasSessions && (
            <>
              {/* Multi-session picker */}
              {sessions.length > 1 && (
                <View className="flex-row gap-2 mb-4">
                  {sessions.map((s, i) => (
                    <Pressable
                      key={s.id}
                      className={`px-4 py-2 rounded-full ${
                        i === selectedIndex ? 'bg-primary' : 'bg-white border border-gray-200'
                      }`}
                      onPress={() => handleSessionSwitch(i)}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          i === selectedIndex ? 'text-white' : 'text-text-primary'
                        }`}
                      >
                        Session {i + 1}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Date + Status */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-text-primary font-semibold text-lg">
                  {formatDate(session!.started_at)}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-text-muted text-sm">{session!.protocol}</Text>
                  {session!.completed ? (
                    <View className="bg-primary px-2 py-0.5 rounded-full">
                      <Text className="text-white text-xs">Complete</Text>
                    </View>
                  ) : isInProgress ? (
                    <View className="bg-accent/20 px-2 py-0.5 rounded-full">
                      <Text className="text-accent text-xs font-medium">Live</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Duration */}
              <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
                <Text className="text-accent font-bold text-3xl text-center mb-2">
                  {formatDuration(elapsedMs)}
                </Text>
                {/* Progress bar */}
                <View className="w-full h-2 bg-background rounded-full overflow-hidden mb-2">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </View>
                <Text className="text-text-muted text-xs text-center">
                  {Math.round(progress * 100)}% of {session!.target_hours}h goal
                </Text>
              </View>

              {/* Time details */}
              <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-text-muted text-xs mb-1">Started</Text>
                    <Text className="text-text-primary text-base font-medium">
                      {formatTime(session!.started_at)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-text-muted text-xs mb-1">Ended</Text>
                    <Text className="text-text-primary text-base font-medium">
                      {isInProgress ? 'In progress' : formatTime(session!.ended_at!)}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Hydration — only shown for calendar day taps */}
          {date && <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
            <Text className="text-text-muted text-xs mb-2">
              {hydrationDateLabel ? `Hydration — ${hydrationDateLabel}` : 'Hydration'}
            </Text>
            {waterLoading ? (
              <ActivityIndicator color="#2D6A4F" size="small" />
            ) : (
              <>
                <View className="flex-row items-baseline gap-1 mb-2">
                  <Text className="text-text-primary text-2xl font-bold">
                    {dayWaterMl.toLocaleString()}ml
                  </Text>
                  <Text className="text-text-muted text-xs">
                    / {dailyGoalMl.toLocaleString()}ml goal
                    {waterLogCount > 0 ? ` · ${waterLogCount} ${waterLogCount === 1 ? 'entry' : 'entries'}` : ''}
                  </Text>
                </View>
                {isPro && (
                  <>
                    {/* Progress bar */}
                    <View className="w-full h-2 bg-background rounded-full overflow-hidden mb-2">
                      <View
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.round(hydrationProgress * 100)}%` }}
                      />
                    </View>
                    {hydrationLogs.length > 0 ? (
                      hydrationLogs.map((log) => (
                        <View key={log.id} className="flex-row items-center justify-between py-1.5 border-b border-gray-50">
                          <Text className="text-text-primary text-sm">+{log.amount_ml}ml</Text>
                          <Text className="text-text-muted text-xs">
                            {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-text-muted text-sm">No water logged this day</Text>
                    )}
                  </>
                )}
              </>
            )}
          </View>}

          {hasSessions && (
            <>
              {/* Phase */}
              <Pressable
                className="bg-white rounded-2xl p-4 mb-3"
                style={CARD_SHADOW}
                onPress={() => setPhaseExpanded((p) => !p)}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-text-muted text-xs mb-1">
                      {isInProgress ? 'Current Phase' : 'Phase Reached'}
                    </Text>
                    <Text className="text-accent text-base font-semibold">{phase.name}</Text>
                    <Text className="text-text-muted text-xs mt-0.5">{phase.description}</Text>
                  </View>
                  <Text className="text-text-muted text-base">{phaseExpanded ? '▾' : '▸'}</Text>
                </View>

                {phaseExpanded && (
                  <View className="mt-3 pt-3 border-t border-gray-100">
                    <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Science</Text>
                    <Text className="text-text-primary text-sm mb-3">{phase.science}</Text>

                    <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Tips</Text>
                    {phase.tips.map((tip, i) => (
                      <Text key={i} className="text-text-primary text-sm mb-1">• {tip}</Text>
                    ))}

                    <Text className="text-text-muted text-xs uppercase tracking-wider mt-3 mb-2">Metabolic Markers</Text>
                    <Text className="text-text-primary text-sm">{phase.metabolicMarkers}</Text>
                  </View>
                )}
              </Pressable>

              {/* Notes */}
              {session!.notes && (
                <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
                  <Text className="text-text-muted text-xs mb-1">Notes</Text>
                  <Text className="text-text-primary text-sm italic">{session!.notes}</Text>
                </View>
              )}

              {/* Share */}
              <Pressable
                className={`rounded-2xl py-4 items-center mt-2 ${isPro ? 'bg-primary' : 'bg-gray-200'}`}
                onPress={() => {
                  if (!isPro) {
                    trackPaywallViewed('share_session');
                    router.push('/paywall');
                    return;
                  }
                  trackShareSession();
                  shareSession(session!, dayWaterMl > 0 ? dayWaterMl : undefined);
                }}
              >
                <View className="flex-row items-center gap-2">
                  {!isPro && <Text className="text-primary text-xs font-medium">Pro</Text>}
                  <Text className={`font-bold text-base ${isPro ? 'text-white' : 'text-gray-400'}`}>
                    Share Session
                  </Text>
                </View>
              </Pressable>

              {/* End fast button for in-progress sessions */}
              {isInProgress && onEndSession && (
                <Pressable
                  className="bg-white border border-red-300 rounded-2xl py-4 items-center active:scale-[0.98] mt-2"
                  style={CARD_SHADOW}
                  onPress={() => {
                    Alert.alert(
                      'End Fast?',
                      'Are you sure you want to end your fast?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'End Fast',
                          style: 'destructive',
                          onPress: () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onEndSession(session!.id, progress >= 0.9);
                            onClose();
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text className="text-red-500 font-semibold text-base">End Fast</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
