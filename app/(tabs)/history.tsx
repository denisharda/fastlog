import { useState, Fragment } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { FastingSession } from '../../types';
import { FastCard } from '../../components/history/FastCard';
import { FastCalendar } from '../../components/history/FastCalendar';
import { StatsRow } from '../../components/history/StatsRow';
import { SessionDetailDrawer } from '../../components/history/SessionDetailDrawer';
import { useFastingStore } from '../../stores/fastingStore';
import { cancelAllNotifications } from '../../lib/notifications';
import { trackPaywallViewed } from '../../lib/posthog';
import { CARD_SHADOW } from '../../constants/styles';
import { useDailyHydrationTotals } from '../../hooks/useDailyHydration';
import { useHydration } from '../../hooks/useHydration';

const ItemSeparator = () => <View className="h-2" />;

export default function HistoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);
  const activeFast = useFastingStore(s => s.activeFast);
  const storeStop = useFastingStore(s => s.stopFast);

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['fasting_sessions', profile?.id],
    queryFn: async (): Promise<FastingSession[]> => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('fasting_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as FastingSession[];
    },
    enabled: !!profile?.id,
  });

  const hydrationByDay = useDailyHydrationTotals();
  const { dailyGoalMl } = useHydration();

  const [drawerSessions, setDrawerSessions] = useState<FastingSession[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerDate, setDrawerDate] = useState<string | null>(null);

  function handleCardPress(session: FastingSession) {
    setDrawerSessions([session]);
    setDrawerDate(new Date(session.started_at).toDateString());
    setDrawerVisible(true);
  }

  function handleDayPress(dateString: string) {
    const daySessions = (sessions ?? []).filter(
      (s) => new Date(s.started_at).toDateString() === dateString
    );
    setDrawerSessions(daySessions);
    setDrawerDate(dateString);
    setDrawerVisible(true);
  }

  async function handleEndSession(sessionId: string, completed: boolean) {
    // Update Supabase directly — works for fasts started on any device
    const { error: dbError } = await supabase
      .from('fasting_sessions')
      .update({ ended_at: new Date().toISOString(), completed })
      .eq('id', sessionId);

    if (dbError) {
      console.error('[history] endSession DB error:', dbError);
      return;
    }

    // If this is also the locally active fast, clear local state
    if (activeFast?.sessionId === sessionId) {
      storeStop();
      cancelAllNotifications();
    }

    queryClient.invalidateQueries({ queryKey: ['fasting_sessions'] });
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#2D6A4F" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-red-400 text-center mb-4">Failed to load history.</Text>
        <Pressable
          className="bg-white px-6 py-3 rounded-xl" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}
          onPress={() => queryClient.invalidateQueries({ queryKey: ['fasting_sessions', profile?.id] })}
        >
          <Text className="text-text-primary font-medium">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const visibleSessions = isPro ? sessions : sessions?.slice(0, 3);
  const isEmpty = !sessions || sessions.length === 0;

  return (
    <>
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 24 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-text-primary text-2xl font-bold pt-4">History</Text>
      <Text className="text-text-muted text-xs mb-3">Last 28 days</Text>

      {isEmpty ? (
        <View className="items-center justify-center px-6 py-20">
          <Text className="text-4xl mb-4">⏱️</Text>
          <Text className="text-text-primary text-lg font-bold mb-2 text-center">
            No fasts yet
          </Text>
          <Text className="text-text-muted text-center">
            Start your first fast on the Timer tab and your history will appear here.
          </Text>
        </View>
      ) : (
        <View>
          <StatsRow sessions={sessions ?? []} />
          <FastCalendar
            sessions={sessions ?? []}
            onDayPress={handleDayPress}
            hydrationByDay={hydrationByDay}
            dailyGoalMl={dailyGoalMl}
          />
          <Text className="text-text-primary font-bold text-xl mt-4 mb-3">Recent Fasts</Text>
          {visibleSessions!.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <ItemSeparator />}
              <FastCard session={item} onPress={() => handleCardPress(item)} />
            </Fragment>
          ))}
          {!isPro && sessions && sessions.length > 3 && (
            <Pressable
              className="bg-white rounded-2xl p-5 mt-2 items-center"
              style={CARD_SHADOW}
              onPress={() => {
                trackPaywallViewed('history_soft_paywall');
                router.push('/paywall');
              }}
            >
              <Text className="text-text-primary font-bold text-base mb-1">
                Unlock Full History
              </Text>
              <Text className="text-text-muted text-sm text-center mb-3">
                See all your fasts, detailed stats, and track your progress over time
              </Text>
              <View className="bg-primary px-6 py-3 rounded-xl">
                <Text className="text-white font-semibold">Upgrade to Pro</Text>
              </View>
            </Pressable>
          )}
        </View>
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
    </>
  );
}
