import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        {/* Logo / hero area */}
        <View className="mb-12 items-center">
          <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-6">
            <Text className="text-4xl">⏱</Text>
          </View>
          <Text className="text-4xl font-bold text-text-primary mb-2">FastAI</Text>
          <Text className="text-text-muted text-center text-base">
            Intermittent fasting with{'\n'}AI-powered check-ins
          </Text>
        </View>

        {/* CTA buttons */}
        <View className="w-full gap-3">
          <Pressable
            className="w-full bg-primary py-4 rounded-2xl items-center"
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text className="text-text-primary font-semibold text-lg">Get Started</Text>
          </Pressable>

          <Pressable
            className="w-full border border-surface py-4 rounded-2xl items-center"
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text className="text-text-muted font-medium text-lg">Sign In</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
