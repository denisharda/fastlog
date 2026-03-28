import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F2F2F7' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="protocol" />
      <Stack.Screen name="goal" />
      <Stack.Screen name="trial" />
      {/* AI coach screen hidden — re-enable when AI features return */}
    </Stack>
  );
}
