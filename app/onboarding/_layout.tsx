import { Stack } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';

export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="protocol" />
      <Stack.Screen name="goal" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
