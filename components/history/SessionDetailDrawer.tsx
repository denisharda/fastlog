import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { FastingSession } from '../../types';
import { getCurrentPhase } from '../../constants/phases';
import { cardShadow, hexAlpha } from '../../constants/theme';
import { useNow } from '../../hooks/useNow';
import { useDailyHydration } from '../../hooks/useDailyHydration';
import { useHydration } from '../../hooks/useHydration';
import { trackPaywallViewed, trackShareSession } from '../../lib/posthog';
import { shareSession } from '../../lib/shareSession';
import { useTheme } from '../../hooks/useTheme';

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
  const theme = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [phaseExpanded, setPhaseExpanded] = useState(false);

  useEffect(() => {
    setSelectedIndex(0);
    setPhaseExpanded(false);
  }, [sessions]);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const session = sessions[selectedIndex];
  const isInProgress = session && !session.ended_at;

  const now = useNow(visible && !!isInProgress);

  const { logs: hydrationLogs, totalMl: dayWaterMl, logCount: waterLogCount, isLoading: waterLoading } = useDailyHydration(date ?? null);
  const { dailyGoalMl } = useHydration();

  const hasSessions = sessions.length > 0 && !!session;

  const snapPoints = useMemo(() => ['85%', '95%'], []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />
    ),
    [],
  );

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

  const cardStyle = { backgroundColor: theme.surface, ...cardShadow(theme) };
  const trackStyle = { backgroundColor: theme.surface2 };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.bg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
      handleIndicatorStyle={{ backgroundColor: theme.hairline, width: 40, height: 4 }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
        <Text className="text-xl font-bold" style={{ color: theme.text }}>
          {hasSessions ? 'Session Details' : 'Daily Summary'}
        </Text>
        <Pressable
          onPress={onClose}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Close session details"
        >
          <Text className="text-lg" style={{ color: theme.textMuted }}>Done</Text>
        </Pressable>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {hasSessions && (
          <>
            {/* Multi-session picker — horizontally scrollable when many sessions */}
            {sessions.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 24 }}
                style={{ marginHorizontal: -24, paddingLeft: 24, marginBottom: 16 }}
              >
                {sessions.map((s, i) => {
                  const isSelected = i === selectedIndex;
                  return (
                    <Pressable
                      key={s.id}
                      className="px-4 py-2 rounded-full"
                      style={{
                        backgroundColor: isSelected ? theme.primary : theme.surface,
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: theme.hairline,
                      }}
                      onPress={() => handleSessionSwitch(i)}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: isSelected ? '#FFFFFF' : theme.text }}
                      >
                        Session {i + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Date + Status */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-semibold text-lg" style={{ color: theme.text }}>
                {formatDate(session!.started_at)}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm" style={{ color: theme.textMuted }}>{session!.protocol}</Text>
                {session!.completed ? (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: theme.primary }}>
                    <Text className="text-white text-xs">Complete</Text>
                  </View>
                ) : isInProgress ? (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: hexAlpha(theme.accent, 51) }}>
                    <Text className="text-xs font-medium" style={{ color: theme.accent }}>Live</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Duration */}
            <View className="rounded-2xl p-4 mb-3" style={cardStyle}>
              <Text className="font-bold text-3xl text-center mb-2" style={{ color: theme.accent }}>
                {formatDuration(elapsedMs)}
              </Text>
              <View className="w-full h-2 rounded-full overflow-hidden mb-2" style={trackStyle}>
                <View
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: theme.primary }}
                />
              </View>
              <Text className="text-xs text-center" style={{ color: theme.textMuted }}>
                {Math.round(progress * 100)}% of {session!.target_hours}h goal
              </Text>
            </View>

            {/* Time details */}
            <View className="rounded-2xl p-4 mb-3" style={cardStyle}>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-xs mb-1" style={{ color: theme.textMuted }}>Started</Text>
                  <Text className="text-base font-medium" style={{ color: theme.text }}>
                    {formatTime(session!.started_at)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs mb-1" style={{ color: theme.textMuted }}>Ended</Text>
                  <Text className="text-base font-medium" style={{ color: theme.text }}>
                    {isInProgress ? 'In progress' : formatTime(session!.ended_at!)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Hydration — only shown for calendar day taps */}
        {date && (
          <View className="rounded-2xl p-4 mb-3" style={cardStyle}>
            <Text className="text-xs mb-2" style={{ color: theme.textMuted }}>
              {hydrationDateLabel ? `Hydration — ${hydrationDateLabel}` : 'Hydration'}
            </Text>
            {waterLoading ? (
              <ActivityIndicator color={theme.water} size="small" />
            ) : (
              <>
                <View className="flex-row items-baseline gap-1 mb-2">
                  <Text className="text-2xl font-bold" style={{ color: theme.text }}>
                    {dayWaterMl.toLocaleString()}ml
                  </Text>
                  <Text className="text-xs" style={{ color: theme.textMuted }}>
                    / {dailyGoalMl.toLocaleString()}ml goal
                    {waterLogCount > 0 ? ` · ${waterLogCount} ${waterLogCount === 1 ? 'entry' : 'entries'}` : ''}
                  </Text>
                </View>
                {isPro && (
                  <>
                    <View className="w-full h-2 rounded-full overflow-hidden mb-2" style={trackStyle}>
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(hydrationProgress * 100)}%`, backgroundColor: theme.primary }}
                      />
                    </View>
                    {hydrationLogs.length > 0 ? (
                      hydrationLogs.map(log => (
                        <View
                          key={log.id}
                          className="flex-row items-center justify-between py-1.5"
                          style={{ borderBottomWidth: 1, borderBottomColor: theme.hairline }}
                        >
                          <Text className="text-sm" style={{ color: theme.text }}>+{log.amount_ml}ml</Text>
                          <Text className="text-xs" style={{ color: theme.textMuted }}>
                            {new Date(log.logged_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-sm" style={{ color: theme.textMuted }}>No water logged this day</Text>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {hasSessions && (
          <>
            {/* Phase */}
            <Pressable
              className="rounded-2xl p-4 mb-3"
              style={cardStyle}
              onPress={() => setPhaseExpanded(p => !p)}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs mb-1" style={{ color: theme.textMuted }}>
                    {isInProgress ? 'Current Phase' : 'Phase Reached'}
                  </Text>
                  <Text className="text-base font-semibold" style={{ color: theme.accent }}>{phase.name}</Text>
                  <Text className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{phase.description}</Text>
                </View>
                <Text className="text-base" style={{ color: theme.textMuted }}>{phaseExpanded ? '▾' : '▸'}</Text>
              </View>

              {phaseExpanded && (
                <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: theme.hairline }}>
                  <Text className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>Science</Text>
                  <Text className="text-sm mb-3" style={{ color: theme.text }}>{phase.science}</Text>

                  <Text className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>Tips</Text>
                  {phase.tips.map((tip, i) => (
                    <Text key={i} className="text-sm mb-1" style={{ color: theme.text }}>
                      • {tip}
                    </Text>
                  ))}

                  <Text className="text-xs uppercase tracking-wider mt-3 mb-2" style={{ color: theme.textMuted }}>
                    Metabolic Markers
                  </Text>
                  <Text className="text-sm" style={{ color: theme.text }}>{phase.metabolicMarkers}</Text>
                </View>
              )}
            </Pressable>

            {/* Notes */}
            {session!.notes && (
              <View className="rounded-2xl p-4 mb-3" style={cardStyle}>
                <Text className="text-xs mb-1" style={{ color: theme.textMuted }}>Notes</Text>
                <Text className="text-sm italic" style={{ color: theme.text }}>{session!.notes}</Text>
              </View>
            )}

            {/* Share */}
            <Pressable
              className="rounded-2xl py-4 items-center mt-2"
              style={{ backgroundColor: isPro ? theme.primary : theme.surface2 }}
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
                {!isPro && <Text className="text-xs font-medium" style={{ color: theme.primary }}>Pro</Text>}
                <Text
                  className="font-bold text-base"
                  style={{ color: isPro ? '#FFFFFF' : theme.textFaint }}
                >
                  Share Session
                </Text>
              </View>
            </Pressable>

            {/* End fast button for in-progress sessions */}
            {isInProgress && onEndSession && (
              <Pressable
                className="rounded-2xl py-4 items-center active:scale-[0.98] mt-2"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: hexAlpha(theme.danger, 102),
                  ...cardShadow(theme),
                }}
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
                    ],
                  );
                }}
              >
                <Text className="font-semibold text-base" style={{ color: theme.danger }}>End Fast</Text>
              </Pressable>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
