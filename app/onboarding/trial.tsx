import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trackPaywallViewed } from '../../lib/posthog';

const PRO_FEATURES = [
  'Full fasting history & analytics',
  'Streak tracking & stats',
  'Phase science & metabolic insights',
  'Hydration tracking & daily goals',
  'Smart fasting notifications',
];

export default function TrialScreen() {
  const router = useRouter();

  function handleStartTrial() {
    trackPaywallViewed('onboarding_trial');
    router.push('/paywall');
  }

  function handleSkip() {
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 justify-between py-8">
        <View>
          <Text className="text-text-primary text-3xl font-bold mb-2">
            Try Pro free for 7 days
          </Text>
          <Text className="text-text-muted text-base mb-8">
            Get the most out of your fasting journey with advanced insights and tracking.
          </Text>

          {PRO_FEATURES.map((feature, i) => (
            <View key={i} className="flex-row items-center gap-3 mb-4">
              <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                <Text className="text-white text-xs font-bold">✓</Text>
              </View>
              <Text className="text-text-primary text-base flex-1">{feature}</Text>
            </View>
          ))}
        </View>

        <View className="gap-3">
          <Pressable
            className="bg-primary py-4 rounded-2xl items-center"
            onPress={handleStartTrial}
          >
            <Text className="text-white font-bold text-lg">Start Free Trial</Text>
          </Pressable>
          <Pressable
            className="py-3 items-center"
            onPress={handleSkip}
          >
            <Text className="text-text-muted text-base">Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
