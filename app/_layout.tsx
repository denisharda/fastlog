import '../global.css';
import { validateEnv } from '../lib/validateEnv';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/auth';
import { useUserStore } from '../stores/userStore';
import { initRevenueCat } from '../lib/revenuecat';
import { initPostHog, trackAppLaunched } from '../lib/posthog';

validateEnv();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function useProtectedRoute(session: Session | null, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const { setProfile } = useUserStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Not signed in — redirect to auth
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      // Signed in — load profile and redirect to tabs
      fetchProfile(session.user.id).then((profile) => {
        if (profile) {
          setProfile({
            id: profile.id,
            name: profile.name,
            coach_personality: profile.coach_personality,
            preferred_protocol: profile.preferred_protocol,
            daily_water_goal_ml: profile.daily_water_goal_ml ?? 2000,
            push_token: null,
            created_at: profile.created_at,
          });
          router.replace('/(tabs)');
        } else {
          // No profile yet — go to onboarding
          router.replace('/onboarding/protocol');
        }
      });
    }
  }, [session, isLoading, segments]);
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initRevenueCat();
    initPostHog();
    trackAppLaunched();

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useProtectedRoute(session, isLoading);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2D6A4F" size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen
              name="paywall"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
