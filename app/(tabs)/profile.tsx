import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { COACH_LIST } from '../../constants/coaches';
import { PROTOCOL_LIST } from '../../constants/protocols';
import { restorePurchases } from '../../lib/revenuecat';
import { trackPaywallViewed } from '../../lib/posthog';
import { useState } from 'react';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isPro, setProfile } = useUserStore();
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
    router.replace('/(auth)/welcome');
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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Text className="text-text-primary text-2xl font-bold mb-6">Profile</Text>

        {/* User info */}
        <View className="bg-surface rounded-2xl p-4 mb-4">
          <Text className="text-text-muted text-xs mb-1 uppercase tracking-wider">Account</Text>
          <Text className="text-text-primary font-semibold text-lg">
            {profile?.name ?? 'Faster'}
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              className={`px-2 py-0.5 rounded-full ${isPro ? 'bg-primary' : 'bg-surface border border-text-muted'}`}
            >
              <Text className="text-text-primary text-xs font-medium">
                {isPro ? 'Pro' : 'Free'}
              </Text>
            </View>
          </View>
        </View>

        {/* Upgrade banner (free users only) */}
        {!isPro && (
          <Pressable
            className="bg-primary rounded-2xl p-4 mb-4 flex-row items-center justify-between"
            onPress={handleUpgradePress}
          >
            <View>
              <Text className="text-text-primary font-bold text-base">Upgrade to Pro</Text>
              <Text className="text-text-primary opacity-80 text-sm">
                AI check-ins, history, streaks
              </Text>
            </View>
            <Text className="text-text-primary text-xl">→</Text>
          </Pressable>
        )}

        {/* Fasting Protocol */}
        <View className="bg-surface rounded-2xl p-4 mb-4">
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
                    : 'border-surface bg-background'
                }`}
                onPress={async () => {
                  if (!profile) return;
                  await supabase
                    .from('profiles')
                    .update({ preferred_protocol: protocol.id })
                    .eq('id', profile.id);
                }}
              >
                <Text className="text-text-primary font-medium">{protocol.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* AI Coach (Pro only) */}
        <View className="bg-surface rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-muted text-xs uppercase tracking-wider">AI Coach</Text>
            {!isPro && (
              <Text className="text-accent text-xs">Pro only</Text>
            )}
          </View>
          <View className="gap-2">
            {COACH_LIST.map((coach) => (
              <Pressable
                key={coach.id}
                className={`flex-row items-center p-3 rounded-xl border ${
                  profile?.coach_personality === coach.id
                    ? 'bg-primary border-primary'
                    : 'border-transparent bg-background'
                } ${!isPro ? 'opacity-50' : ''}`}
                onPress={async () => {
                  if (!profile || !isPro) {
                    handleUpgradePress();
                    return;
                  }
                  await supabase
                    .from('profiles')
                    .update({ coach_personality: coach.id })
                    .eq('id', profile.id);
                }}
              >
                <Text className="text-xl mr-3">{coach.emoji}</Text>
                <View>
                  <Text className="text-text-primary font-medium">{coach.label}</Text>
                  <Text className="text-text-muted text-xs">{coach.tagline}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View className="gap-3 mt-2">
          <Pressable
            className="bg-surface py-4 rounded-2xl items-center"
            onPress={handleRestorePurchases}
            disabled={restoringPurchases}
          >
            {restoringPurchases ? (
              <ActivityIndicator color="#F5F5F5" />
            ) : (
              <Text className="text-text-primary font-medium">Restore Purchases</Text>
            )}
          </Pressable>

          <Pressable
            className="border border-red-800 py-4 rounded-2xl items-center"
            onPress={handleSignOut}
          >
            <Text className="text-red-400 font-medium">Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
