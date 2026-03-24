import React from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { FastingSession } from '../../types';
import { FastCard } from '../../components/history/FastCard';
import { FastCalendar } from '../../components/history/FastCalendar';
import { trackPaywallViewed } from '../../lib/posthog';

const ItemSeparator = () => <View className="h-2" />;

export default function HistoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);

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

  function handleUpgradePress() {
    trackPaywallViewed('history_screen');
    router.push('/paywall');
  }

  if (!isPro) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {/* Blurred preview placeholder */}
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
            <Text className="text-3xl">📅</Text>
          </View>
          <Text className="text-text-primary text-xl font-bold mb-2 text-center">
            Fasting History
          </Text>
          <Text className="text-text-muted text-center mb-8">
            Track your progress over time, view streaks, and see your full fasting calendar with FastAI Pro.
          </Text>
          <Pressable
            className="bg-primary px-8 py-4 rounded-2xl"
            onPress={handleUpgradePress}
          >
            <Text className="text-text-primary font-semibold text-lg">Unlock Pro</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#2D6A4F" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-red-400 text-center mb-4">Failed to load history.</Text>
        <Pressable
          className="bg-surface px-6 py-3 rounded-xl"
          onPress={() => queryClient.invalidateQueries({ queryKey: ['fasting_sessions', profile?.id] })}
        >
          <Text className="text-text-primary font-medium">Try Again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isEmpty = !sessions || sessions.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-4 pb-2">
        <Text className="text-text-primary text-2xl font-bold">History</Text>
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-text-muted text-center">
            No fasts yet. Start your first fast on the Timer tab!
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <FastCalendar sessions={sessions ?? []} />
          }
          renderItem={({ item }) => <FastCard session={item} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}
    </SafeAreaView>
  );
}
