import React, { useState } from 'react';
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
import { useFasting } from '../../hooks/useFasting';
import { trackPaywallViewed } from '../../lib/posthog';

const ItemSeparator = () => <View className="h-2" />;

export default function HistoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);
  const { stopFast } = useFasting();

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
    enabled: !!profile?.id && isPro,
  });

  const [drawerSessions, setDrawerSessions] = useState<FastingSession[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);

  function handleCardPress(session: FastingSession) {
    setDrawerSessions([session]);
    setDrawerVisible(true);
  }

  function handleDayPress(dateString: string) {
    const daySessions = (sessions ?? []).filter(
      (s) => new Date(s.started_at).toDateString() === dateString
    );
    if (daySessions.length === 0) return;
    setDrawerSessions(daySessions);
    setDrawerVisible(true);
  }

  function handleUpgradePress() {
    trackPaywallViewed('history_screen');
    router.push('/paywall');
  }

  if (!isPro) {
    return (
      <View className="flex-1 bg-background">
        {/* Blurred preview placeholder */}
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-white items-center justify-center mb-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
            <Text className="text-3xl">📅</Text>
          </View>
          <Text className="text-text-primary text-xl font-bold mb-2 text-center">
            Fasting History
          </Text>
          <Text className="text-text-muted text-center mb-8">
            Track your progress over time, view streaks, and see your full fasting calendar with FastAI Pro.
          </Text>
          <Pressable
            className="bg-text-primary px-8 py-4 rounded-2xl"
            onPress={handleUpgradePress}
          >
            <Text className="text-white font-semibold text-lg">Unlock Pro</Text>
          </Pressable>
        </View>
      </View>
    );
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
        <View className="flex-1 items-center justify-center px-6 py-20">
          <Text className="text-text-muted text-center">
            No fasts yet. Start your first fast on the Timer tab!
          </Text>
        </View>
      ) : (
        <View>
          <StatsRow sessions={sessions ?? []} />
          <FastCalendar sessions={sessions ?? []} onDayPress={handleDayPress} />
          <Text className="text-text-primary font-bold text-xl mt-4 mb-3">Recent Fasts</Text>
          {sessions!.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <ItemSeparator />}
              <FastCard session={item} onPress={() => handleCardPress(item)} />
            </React.Fragment>
          ))}
        </View>
      )}
    </ScrollView>
    <SessionDetailDrawer
      visible={drawerVisible}
      sessions={drawerSessions}
      onClose={() => setDrawerVisible(false)}
      onStopFast={stopFast}
    />
    </>
  );
}
