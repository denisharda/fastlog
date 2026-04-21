import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Circle, Path } from 'react-native-svg';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { FastingSession } from '../../types';
import { SessionDetailDrawer } from '../../components/history/SessionDetailDrawer';
import { useFastingStore } from '../../stores/fastingStore';
import { useNow } from '../../hooks/useNow';
import { cancelAllNotifications } from '../../lib/notifications';
import { trackPaywallViewed } from '../../lib/posthog';
import { useDailyHydrationTotals } from '../../hooks/useDailyHydration';
import { useHydration } from '../../hooks/useHydration';
import { useTheme } from '../../hooks/useTheme';
import { Card, ScreenHeader, CircleIcon } from '../../components/ui';
import { TABULAR, hexAlpha } from '../../constants/theme';
import { TAB_BAR_HEIGHT } from '../../components/ui/TabBar';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DayCell {
  day: number;
  dateString: string;
  state: 'empty' | 'partial' | 'complete' | 'live';
  progress: number;
  hydration: number; // 0-1
  today: boolean;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function computeMonthCells(
  monthDate: Date,
  allSessions: FastingSession[],
  hydrationByDay: Record<string, number>,
  dailyGoalMl: number,
  now: number,
): { days: DayCell[]; pad: number } {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const pad = new Date(year, month, 1).getDay();

  const byDay = new Map<
    string,
    { completed: boolean; partial: boolean; live: boolean; progress: number }
  >();
  for (const s of allSessions) {
    const d = new Date(s.started_at);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const key = d.toDateString();
    const existing =
      byDay.get(key) ?? { completed: false, partial: false, live: false, progress: 0 };
    const endMs = s.ended_at ? new Date(s.ended_at).getTime() : now;
    const ratio = Math.min(
      1,
      (endMs - new Date(s.started_at).getTime()) / (s.target_hours * 3600 * 1000),
    );
    existing.progress = Math.max(existing.progress, ratio);
    if (s.completed) existing.completed = true;
    else if (s.ended_at) existing.partial = true;
    else existing.live = true;
    byDay.set(key, existing);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    const key = date.toDateString();
    const d = byDay.get(key);
    const state: DayCell['state'] = d?.completed
      ? 'complete'
      : d?.partial
        ? 'partial'
        : d?.live
          ? 'live'
          : 'empty';
    const isoDate = date.toISOString().split('T')[0];
    const hyd = hydrationByDay[isoDate] ?? 0;
    const hydration = Math.max(0, Math.min(1, hyd / dailyGoalMl));
    return {
      day: i + 1,
      dateString: key,
      state,
      progress: d?.progress ?? 0,
      hydration,
      today: sameDay(date, today),
    };
  });

  return { days, pad };
}

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);
  const activeFast = useFastingStore(s => s.activeFast);
  const storeStop = useFastingStore(s => s.stopFast);

  const [cursorMonth, setCursorMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['fasting_sessions', profile?.id],
    queryFn: async (): Promise<FastingSession[]> => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('fasting_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as FastingSession[];
    },
    enabled: !!profile?.id,
  });

  const hydrationByDay = useDailyHydrationTotals();
  const { dailyGoalMl } = useHydration();
  const now = useNow(!!activeFast);

  const [drawerSessions, setDrawerSessions] = useState<FastingSession[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerDate, setDrawerDate] = useState<string | null>(null);

  const allSessions = sessions ?? [];

  const pagerRef = useRef<ScrollView>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const pageMonths = useMemo(() => {
    return [
      new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1),
      cursorMonth,
      new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1),
    ];
  }, [cursorMonth]);

  const pageCells = useMemo(
    () => pageMonths.map(m => computeMonthCells(m, allSessions, hydrationByDay, dailyGoalMl, now)),
    [pageMonths, allSessions, hydrationByDay, dailyGoalMl, now],
  );

  // Snap pager to the middle (current) page whenever cursor month or layout changes.
  useEffect(() => {
    if (gridWidth > 0) {
      pagerRef.current?.scrollTo({ x: gridWidth, animated: false });
    }
  }, [cursorMonth, gridWidth]);

  function handlePagerEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (gridWidth === 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / gridWidth);
    if (index === 0) {
      setCursorMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    } else if (index === 2) {
      setCursorMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    }
  }

  const stats = useMemo(() => {
    if (allSessions.length === 0) {
      return { streak: 0, longestHours: 0, avgHours: 0, total: 0 };
    }
    let streak = 0;
    const sortedByDay = [...allSessions]
      .filter(s => s.completed)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    const days = new Set(sortedByDay.map(s => new Date(s.started_at).toDateString()));
    const cursor = new Date();
    // If today isn't in the set, check yesterday as start of streak
    if (!days.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (days.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    let longest = 0;
    let totalSum = 0;
    let totalCount = 0;
    for (const s of allSessions) {
      if (!s.ended_at) continue;
      const hours = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000;
      if (hours > longest) longest = hours;
      totalSum += hours;
      totalCount++;
    }
    const avg = totalCount > 0 ? totalSum / totalCount : 0;
    return { streak, longestHours: longest, avgHours: avg, total: allSessions.length };
  }, [allSessions]);

  const recentFasts = useMemo(() => {
    const active = allSessions.filter(s => !s.ended_at);
    const ended = allSessions.filter(s => s.ended_at).slice(0, isPro ? 20 : 3);
    return [...active, ...ended];
  }, [allSessions, isPro]);

  function handleDayPress(dateString: string) {
    const daySessions = allSessions.filter(s => new Date(s.started_at).toDateString() === dateString);
    if (daySessions.length === 0) return;
    setDrawerSessions(daySessions);
    setDrawerDate(dateString);
    setDrawerVisible(true);
  }

  function handleCardPress(session: FastingSession) {
    setDrawerSessions([session]);
    setDrawerDate(null);
    setDrawerVisible(true);
  }

  async function handleEndSession(sessionId: string, completed: boolean) {
    const { error: dbError } = await supabase
      .from('fasting_sessions')
      .update({ ended_at: new Date().toISOString(), completed })
      .eq('id', sessionId);
    if (dbError) return;
    if (activeFast?.sessionId === sessionId) {
      storeStop();
      cancelAllNotifications();
    }
    queryClient.invalidateQueries({ queryKey: ['fasting_sessions'] });
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: theme.danger, textAlign: 'center', marginBottom: 16 }}>Failed to load history.</Text>
        <Pressable
          onPress={() => queryClient.invalidateQueries({ queryKey: ['fasting_sessions', profile?.id] })}
          style={{ backgroundColor: theme.surface, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: theme.text, fontWeight: '500' }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const monthLabel = cursorMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const statCards = [
    { l: 'Streak', v: String(stats.streak), s: 'days' },
    { l: 'Longest', v: stats.longestHours.toFixed(0), s: 'h' },
    { l: 'Avg fast', v: stats.avgHours.toFixed(1), s: 'h' },
    { l: 'Total', v: String(stats.total), s: 'fasts' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader theme={theme} title="History" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_HEIGHT + 40 }} showsVerticalScrollIndicator={false}>
        {allSessions.length === 0 ? (
          <Card theme={theme} padding={24} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 6 }}>No fasts yet</Text>
            <Text style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
              Start your first fast on the Timer tab and your history will appear here.
            </Text>
          </Card>
        ) : (
          <>
            {/* Calendar */}
            <Card theme={theme} padding={16} style={{ marginTop: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '600', color: theme.text, letterSpacing: -0.3 }}>
                  {monthLabel}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <CircleIcon
                    theme={theme}
                    size={28}
                    background={theme.surface2}
                    onPress={() =>
                      setCursorMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                    }
                  >
                    <Svg width={7} height={11} viewBox="0 0 7 11" fill="none">
                      <Path
                        d="M6 1L1 5.5 6 10"
                        stroke={theme.textMuted}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </CircleIcon>
                  <CircleIcon
                    theme={theme}
                    size={28}
                    background={theme.surface2}
                    onPress={() =>
                      setCursorMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                    }
                  >
                    <Svg width={7} height={11} viewBox="0 0 7 11" fill="none">
                      <Path
                        d="M1 1l5 4.5L1 10"
                        stroke={theme.textMuted}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </CircleIcon>
                </View>
              </View>

              {/* Weekday header */}
              <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                {WEEKDAYS.map((w, i) => (
                  <Text
                    key={i}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 10,
                      fontWeight: '600',
                      color: theme.textFaint,
                      letterSpacing: 0.5,
                    }}
                  >
                    {w}
                  </Text>
                ))}
              </View>

              {/* Swipeable months */}
              <View
                onLayout={e => {
                  const w = e.nativeEvent.layout.width;
                  if (w !== gridWidth) setGridWidth(w);
                }}
                style={{ overflow: 'hidden' }}
              >
                {gridWidth > 0 && (
                  <ScrollView
                    ref={pagerRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handlePagerEnd}
                    decelerationRate="fast"
                  >
                    {pageCells.map((pc, idx) => (
                      <View key={idx} style={{ width: gridWidth, flexDirection: 'row', flexWrap: 'wrap' }}>
                        {Array.from({ length: pc.pad }).map((_, i) => (
                          <View key={`p-${i}`} style={{ width: `${100 / 7}%`, height: 52}} />
                        ))}
                        {pc.days.map(day => {
                          const ringColor =
                            day.state === 'complete'
                              ? theme.primary
                              : day.state === 'live'
                                ? theme.primarySoft
                                : day.state === 'partial'
                                  ? theme.accent
                                  : theme.hairline;
                          return (
                            <Pressable
                              key={day.day}
                              onPress={() => handleDayPress(day.dateString)}
                              style={{
                                width: `${100 / 7}%`,
                                height: 46,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <View
                                style={{
                                  width: 42,
                                  height: 42,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Svg
                                  width={42}
                                  height={42}
                                  viewBox="0 0 40 40"
                                  style={{ position: 'absolute' }}
                                >
                                  <Circle cx={20} cy={20} r={16} fill="none" stroke={theme.hairline} strokeWidth={2} />
                                  {(day.state === 'complete' || day.state === 'partial' || day.state === 'live') && (
                                    <Circle
                                      cx={20}
                                      cy={20}
                                      r={16}
                                      fill="none"
                                      stroke={ringColor}
                                      strokeWidth={2.5}
                                      strokeDasharray={`${(day.state === 'complete' ? 1 : day.state === 'live' ? day.progress : 0.65) * 2 * Math.PI * 16} ${2 * Math.PI * 16}`}
                                      strokeLinecap="round"
                                      transform="rotate(-90 20 20)"
                                    />
                                  )}
                                  {day.today && <Circle cx={20} cy={20} r={14} fill={theme.text} opacity={0.06} />}
                                </Svg>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: day.today ? '700' : '500',
                                    color: day.today ? theme.text : theme.textMuted,
                                    ...TABULAR,
                                  }}
                                >
                                  {day.day}
                                </Text>
                              </View>
                              {day.hydration > 0.3 && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    bottom: 2,
                                    width: 4,
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: theme.water,
                                    opacity: day.hydration,
                                  }}
                                />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </Card>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {statCards.map((s) => (
                <View
                  key={s.l}
                  style={{
                    flex: 1,
                    backgroundColor: theme.surface,
                    borderRadius: 14,
                    padding: 10,
                    borderWidth: theme.isDark ? 0.5 : 0,
                    borderColor: theme.hairline,
                    shadowColor: '#2A1F14',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: theme.isDark ? 0 : 0.04,
                    shadowRadius: 2,
                    elevation: theme.isDark ? 0 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: theme.textFaint,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.l}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 4 }}>
                    <Text style={{ fontSize: 20, fontWeight: '600', color: theme.text, letterSpacing: -0.4, ...TABULAR }}>
                      {s.v}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textFaint }}>{s.s}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Recent fasts */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 18,
                paddingHorizontal: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: theme.textFaint,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Recent Fasts
              </Text>
            </View>

            <Card theme={theme} padding={0}>
              {recentFasts.map((f, i) => {
                const isLive = !f.ended_at;
                const endMs = isLive ? now : new Date(f.ended_at!).getTime();
                const duration = (endMs - new Date(f.started_at).getTime()) / 3600000;
                const hours = Math.floor(duration);
                const minutes = Math.floor((duration - hours) * 60);
                const date = new Date(f.started_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => handleCardPress(f)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      paddingHorizontal: 16,
                      borderBottomWidth: i < recentFasts.length - 1 ? 0.5 : 0,
                      borderBottomColor: theme.hairline,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isLive
                          ? hexAlpha(theme.primarySoft, 0x33)
                          : f.completed
                            ? hexAlpha(theme.primary, 0x22)
                            : theme.hairline,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      {isLive ? (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: theme.primarySoft,
                          }}
                        />
                      ) : f.completed ? (
                        <Svg width={14} height={14} viewBox="0 0 14 14">
                          <Path
                            d="M2 7l3.5 3.5L12 3.5"
                            stroke={theme.primary}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </Svg>
                      ) : (
                        <Svg width={14} height={14} viewBox="0 0 14 14">
                          <Path d="M7 3v4.5" stroke={theme.textMuted} strokeWidth={2} strokeLinecap="round" />
                          <Circle cx={7} cy={10.5} r={1} fill={theme.textMuted} />
                        </Svg>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: theme.text,
                            letterSpacing: -0.2,
                            ...TABULAR,
                          }}
                        >
                          {hours}h {minutes.toString().padStart(2, '0')}m{' '}
                          <Text style={{ color: theme.textFaint, fontWeight: '500' }}>· {f.protocol}</Text>
                        </Text>
                        {isLive && (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 5,
                              backgroundColor: hexAlpha(theme.primarySoft, 0x33),
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 9,
                                fontWeight: '700',
                                color: theme.primarySoft,
                                letterSpacing: 0.6,
                              }}
                            >
                              LIVE
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        {isLive ? `In progress · ${date}` : date}
                      </Text>
                    </View>
                    <Svg width={7} height={12} viewBox="0 0 7 12">
                      <Path
                        d="M1 1l5 5-5 5"
                        stroke={theme.textFaint}
                        strokeWidth={1.8}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Pressable>
                );
              })}
            </Card>

            {/* Pro gate */}
            {!isPro && allSessions.filter(s => s.ended_at).length > 3 && (
              <Card
                theme={theme}
                padding={14}
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                    {allSessions.filter(s => s.ended_at).length - 3} more fasts logged
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                    Unlock to see your full journey
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    trackPaywallViewed('history_soft_paywall');
                    router.push('/paywall');
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: theme.text,
                  }}
                >
                  <Text style={{ color: theme.bg, fontSize: 13, fontWeight: '600' }}>Unlock</Text>
                </Pressable>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <SessionDetailDrawer
        visible={drawerVisible}
        sessions={drawerSessions}
        date={drawerDate}
        onClose={() => setDrawerVisible(false)}
        onEndSession={handleEndSession}
        isPro={isPro}
      />
    </View>
  );
}
