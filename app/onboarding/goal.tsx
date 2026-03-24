import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useUserStore } from '../../stores/userStore';

const GOAL_OPTIONS = [
  { label: 'Lose weight', emoji: '⚡' },
  { label: 'Improve energy', emoji: '🌟' },
  { label: 'Mental clarity', emoji: '🧠' },
  { label: 'Longevity', emoji: '🌿' },
  { label: 'Metabolic health', emoji: '❤️' },
];

export default function OnboardingGoalScreen() {
  const router = useRouter();
  const updateProfile = useUserStore(s => s.updateProfile);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  function toggleGoal(goal: string) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        {/* Progress indicator */}
        <View className="flex-row gap-1 mb-8">
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              className={`h-1 flex-1 rounded-full ${step <= 2 ? 'bg-primary' : 'bg-text-muted/20'}`}
            />
          ))}
        </View>

        <Text className="text-3xl font-bold text-text-primary mb-2">
          What's your goal?
        </Text>
        <Text className="text-text-muted mb-8">
          Optional — select all that apply. These will personalize your AI check-ins in a future update.
        </Text>

        <View className="gap-3 mb-8">
          {GOAL_OPTIONS.map((goal) => {
            const isSelected = selectedGoals.includes(goal.label);
            return (
              <Pressable
                key={goal.label}
                className={`flex-row items-center p-4 rounded-2xl border-2 ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-text-muted/20 bg-white'
                }`}
                onPress={() => toggleGoal(goal.label)}
              >
                <Text className="text-2xl mr-4">{goal.emoji}</Text>
                <Text className="text-text-primary font-medium text-lg flex-1">
                  {goal.label}
                </Text>
                {isSelected && (
                  <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white text-xs">✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View className="gap-3">
          <Pressable
            className="bg-text-primary py-4 rounded-2xl items-center"
            onPress={() => {
              // Goals stored locally for future AI personalization
              // When AI features are built out, these will be sent with check-in requests
              if (selectedGoals.length > 0) {
                updateProfile({ goals: selectedGoals });
              }
              router.push('/onboarding/coach');
            }}
          >
            <Text className="text-white font-semibold text-lg">Continue</Text>
          </Pressable>

          <Pressable
            className="py-4 items-center"
            onPress={() => router.push('/onboarding/coach')}
          >
            <Text className="text-text-muted">Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
