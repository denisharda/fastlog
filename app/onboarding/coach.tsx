import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { COACH_LIST, DEFAULT_COACH } from '../../constants/coaches';
import { CoachPersonality } from '../../types';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';

export default function OnboardingCoachScreen() {
  const router = useRouter();
  const { profile, setCoachPersonality } = useUserStore();
  const [selected, setSelected] = useState<CoachPersonality>(DEFAULT_COACH);

  async function handleFinish() {
    if (profile) {
      setCoachPersonality(selected);
      await supabase
        .from('profiles')
        .update({ coach_personality: selected })
        .eq('id', profile.id);
    }
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        {/* Progress indicator */}
        <View className="flex-row gap-1 mb-8">
          {[1, 2, 3].map((step) => (
            <View key={step} className="h-1 flex-1 rounded-full bg-primary" />
          ))}
        </View>

        <Text className="text-3xl font-bold text-text-primary mb-2">
          Pick your coach
        </Text>
        <Text className="text-text-muted mb-2">
          Your AI coach sends check-ins during your fasts.
        </Text>
        <Text className="text-accent text-sm mb-8">Requires Pro — upgrade anytime</Text>

        <View className="gap-4 mb-8">
          {COACH_LIST.map((coach) => (
            <Pressable
              key={coach.id}
              className={`p-4 rounded-2xl border-2 ${
                selected === coach.id
                  ? 'border-primary bg-primary/10'
                  : 'border-surface bg-surface'
              }`}
              onPress={() => setSelected(coach.id)}
            >
              <View className="flex-row items-center mb-2">
                <Text className="text-3xl mr-3">{coach.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-text-primary font-bold text-lg">{coach.label}</Text>
                  <Text className="text-text-muted text-sm">{coach.tagline}</Text>
                </View>
                {selected === coach.id && (
                  <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                    <Text className="text-text-primary text-xs">✓</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          className="bg-primary py-4 rounded-2xl items-center"
          onPress={handleFinish}
        >
          <Text className="text-text-primary font-semibold text-lg">Start Fasting</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
