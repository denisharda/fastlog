import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUserStore } from '../../stores/userStore';
import { useFastingStore } from '../../stores/fastingStore';
import { useHydrationStore } from '../../stores/hydrationStore';
import { useHydration } from '../../hooks/useHydration';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
// Hidden: AI coach — re-enable when AI features return
// import { COACH_LIST } from '../../constants/coaches';
import { PROTOCOL_LIST } from '../../constants/protocols';
import {
  MIN_DAILY_WATER_GOAL_ML,
  MAX_DAILY_WATER_GOAL_ML,
  WATER_GOAL_STEP_ML,
} from '../../constants/hydration';
import { restorePurchases } from '../../lib/revenuecat';
import { trackPaywallViewed } from '../../lib/posthog';
import { useState } from 'react';
import { CARD_SHADOW } from '../../constants/styles';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);
  const setIsPro = useUserStore(s => s.setIsPro);
  const setPreferredProtocol = useUserStore(s => s.setPreferredProtocol);
  // Hidden: AI coach
  // const setCoachPersonality = useUserStore(s => s.setCoachPersonality);
  const resetUser = useUserStore(s => s.reset);
  const { dailyGoalMl, setDailyGoal } = useHydration();
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  async function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    resetUser();
    useFastingStore.getState().stopFast();
    useHydrationStore.setState({ todayLogs: [], lastResetDate: new Date().toISOString().split('T')[0] });
    // Auth guard in root layout handles redirect
  }

  async function handleRestorePurchases() {
    setRestoringPurchases(true);
    await restorePurchases();
    setRestoringPurchases(false);
  }

  function handleUpgradePress() {
    trackPaywallViewed('profile_screen');
    router.push('/paywall');
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }} contentInsetAdjustmentBehavior="automatic">
        <Text className="text-text-primary text-2xl font-bold mb-6">Profile</Text>

        {/* User info */}
        <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
          <Text className="text-text-muted text-xs mb-1 uppercase tracking-wider">Account</Text>
          <Text className="text-text-primary font-semibold text-lg">
            {profile?.name ?? 'Faster'}
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              className={`px-2 py-0.5 rounded-full ${isPro ? 'bg-primary' : 'bg-background border border-text-muted/30'}`}
            >
              <Text className={`text-xs font-medium ${isPro ? 'text-white' : 'text-text-primary'}`}>
                {isPro ? 'Pro' : 'Free'}
              </Text>
            </View>
          </View>
        </View>

        {/* Upgrade banner (free users only) */}
        {!isPro && (
          <Pressable
            className="bg-primary rounded-2xl p-4 mb-3 flex-row items-center justify-between"
            onPress={handleUpgradePress}
          >
            <View>
              <Text className="text-white font-bold text-base">Upgrade to Pro</Text>
              <Text className="text-white opacity-80 text-sm">
                History, streaks, water tracking
              </Text>
            </View>
            <Text className="text-white text-xl">→</Text>
          </Pressable>
        )}

        {/* Fasting Protocol */}
        <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
          <Text className="text-text-muted text-xs mb-3 uppercase tracking-wider">
            Default Protocol
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {PROTOCOL_LIST.filter((p) => p.id !== 'custom').map((protocol) => (
              <Pressable
                key={protocol.id}
                className={`px-4 py-2 rounded-xl border ${
                  profile?.preferred_protocol === protocol.id
                    ? 'bg-primary border-primary'
                    : 'border-text-muted/20 bg-background'
                }`}
                onPress={async () => {
                  if (!profile) return;
                  Haptics.selectionAsync();
                  setPreferredProtocol(protocol.id);
                  supabase
                    .from('profiles')
                    .update({ preferred_protocol: protocol.id })
                    .eq('id', profile.id)
                    .then(({ error }) => {
                      if (error) console.error('[Profile] Failed to update protocol:', error);
                    });
                }}
              >
                <Text className={`font-medium ${profile?.preferred_protocol === protocol.id ? 'text-white' : 'text-text-primary'}`}>{protocol.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Daily Water Goal */}
        <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
          <Text className="text-text-muted text-xs mb-3 uppercase tracking-wider">
            Daily Water Goal
          </Text>
          <View className="flex-row items-center justify-between">
            <Pressable
              className="w-11 h-11 rounded-full bg-background items-center justify-center"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const next = dailyGoalMl - WATER_GOAL_STEP_ML;
                if (next >= MIN_DAILY_WATER_GOAL_ML) {
                  setDailyGoal(next);
                  if (profile) {
                    supabase
                      .from('profiles')
                      .update({ daily_water_goal_ml: next })
                      .eq('id', profile.id)
                      .then(({ error }) => {
                        if (error) console.error('[Profile] Failed to update water goal:', error);
                      });
                  }
                }
              }}
            >
              <Text className="text-text-primary text-xl font-bold">−</Text>
            </Pressable>
            <Text className="text-text-primary text-lg font-semibold">
              {dailyGoalMl.toLocaleString()} ml
            </Text>
            <Pressable
              className="w-11 h-11 rounded-full bg-background items-center justify-center"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const next = dailyGoalMl + WATER_GOAL_STEP_ML;
                if (next <= MAX_DAILY_WATER_GOAL_ML) {
                  setDailyGoal(next);
                  if (profile) {
                    supabase
                      .from('profiles')
                      .update({ daily_water_goal_ml: next })
                      .eq('id', profile.id)
                      .then(({ error }) => {
                        if (error) console.error('[Profile] Failed to update water goal:', error);
                      });
                  }
                }
              }}
            >
              <Text className="text-text-primary text-xl font-bold">+</Text>
            </Pressable>
          </View>
        </View>

        {/* AI Coach section hidden — re-enable when AI features return */}

        {/* Dev toggle (debug only) */}
        {__DEV__ && (
          <Pressable
            className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between" style={CARD_SHADOW}
            onPress={() => setIsPro(!isPro)}
          >
            <Text className="text-text-primary font-medium">
              Pro Status (Dev Toggle)
            </Text>
            <Text className={`font-bold ${isPro ? 'text-primary' : 'text-red-400'}`}>
              {isPro ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        )}

        {/* Actions */}
        <View className="gap-3 mt-2">
          <Pressable
            className="bg-white py-4 rounded-2xl items-center"
            style={CARD_SHADOW}
            onPress={handleRestorePurchases}
            disabled={restoringPurchases}
          >
            {restoringPurchases ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <Text className="text-text-primary font-medium">Restore Purchases</Text>
            )}
          </Pressable>

          <Pressable
            className="bg-text-primary py-4 rounded-2xl items-center"
            onPress={handleSignOut}
          >
            <Text className="text-white font-medium">Sign Out</Text>
          </Pressable>
        </View>
    </ScrollView>
  );
}
