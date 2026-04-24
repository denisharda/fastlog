import '../global.css';
import { validateEnv } from '../lib/validateEnv';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, useColorScheme, AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/auth';
import { useUserStore } from '../stores/userStore';
import { initRevenueCat, identifyRevenueCatUser } from '../lib/revenuecat';
import { initPostHog, trackAppLaunched, identifyUser } from '../lib/posthog';
import { registerForPushNotifications } from '../lib/notifications';
import { registerDeviceToken } from '../lib/deviceTokens';
import { useSubscription } from '../hooks/useSubscription';
import { syncFastSchedule } from '../lib/fastScheduler';
import { startRealtime, stopRealtime } from '../lib/realtime';
import { syncHydrationWithRemote } from '../lib/hydrationSync';
import { syncWithRemote } from '../lib/endFast';
import { pushWidgetSnapshot } from '../lib/widget';
import { useFastingStore } from '../stores/fastingStore';
import { getCurrentPhase } from '../constants/phases';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

try { validateEnv(); } catch (e) { console.warn('[RootLayout] validateEnv failed:', e); }
try { initRevenueCat(); } catch (e) { console.warn('[RootLayout] RevenueCat init failed:', e); }

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
      fetchProfile(session.user.id)
        .then((profile) => {
          if (profile) {
            setProfile({
              id: profile.id,
              name: profile.name,
              preferred_protocol: profile.preferred_protocol,
              daily_water_goal_ml: profile.daily_water_goal_ml ?? 2000,
              push_token: profile.push_token ?? null,
              created_at: profile.created_at,
            });
            router.replace('/(tabs)');
          } else {
            // No profile yet — go to onboarding
            router.replace('/onboarding/protocol');
          }
        })
        .catch((err) => {
          // Any unexpected throw (network fully offline, JS error in the
          // Supabase client, etc.) must not strand the user on the auth
          // screen. Route them to onboarding as a safe default.
          console.error('[RootLayout] fetchProfile threw:', err);
          router.replace('/onboarding/protocol');
        });
    }
  }, [session, isLoading, segments]);
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profile = useUserStore((s) => s.profile);
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  // Sync Pro status from RevenueCat into the user store
  useSubscription();

  // Identify the user to RevenueCat and PostHog whenever their profile is loaded
  useEffect(() => {
    if (!profile?.id) return;
    try { identifyRevenueCatUser(profile.id); } catch (e) { console.warn('[RootLayout] RC identify failed:', e); }
    try {
      const prefs = useUserStore.getState().notificationPrefs;
      const schedule = useUserStore.getState().fastSchedule;
      identifyUser(profile.id, {
        preferred_protocol: profile.preferred_protocol,
        goal: profile.goal ?? null,
        daily_water_goal_ml: profile.daily_water_goal_ml,
        notif_phase_transitions: prefs.phaseTransitions,
        notif_hydration: prefs.hydration,
        notif_halfway: prefs.halfway,
        notif_complete: prefs.complete,
        fast_schedule_enabled: !!schedule?.enabled,
        signup_date: profile.created_at,
      });
    } catch (e) { console.warn('[RootLayout] PostHog identify failed:', e); }
  }, [profile?.id]);

  // Register for push notifications once we have a profile
  useEffect(() => {
    if (!profile?.id) return;

    registerForPushNotifications()
      .then((token) => {
        if (!token) return;
        // New per-device registration — used by the server fan-out path.
        void registerDeviceToken(profile.id, token);

        // Legacy profiles.push_token write — retained for one release so
        // anything reading that column (legacy scripts, etc.) still works.
        // TODO: remove after one release cycle.
        if (token !== profile.push_token) {
          useUserStore.getState().updateProfile({ push_token: token });
          supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', profile.id)
            .then(({ error }) => {
              if (error) console.warn('[RootLayout] Failed to save legacy push token:', error);
            });
        }
      })
      .catch((e) => {
        console.warn('[RootLayout] Push registration failed:', e);
      });
  }, [profile?.id]);

  // Sync the recurring fast schedule notification on app launch
  useEffect(() => {
    try { syncFastSchedule(); } catch (e) { console.warn('[RootLayout] syncFastSchedule failed:', e); }
  }, []);

  // Realtime subscription — only while app is foregrounded and signed in.
  // Handles instant cross-device sync for fasting_sessions + hydration_logs.
  // On backgrounded → unsubscribe (save battery); the Edge Function pushes
  // carry the signal until next foreground.
  useEffect(() => {
    if (!profile?.id) return;

    void startRealtime();
    void syncHydrationWithRemote();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void startRealtime();
        void syncWithRemote();
        void syncHydrationWithRemote();
      } else {
        void stopRealtime();
      }
    });

    return () => {
      sub.remove();
      void stopRealtime();
    };
  }, [profile?.id]);

  // Handle notification taps — navigate to timer tab and reschedule
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.action === 'start_fast') {
        // Navigate to timer tab — the user will start manually from there
        // We don't auto-start because the user should confirm
        router.push('/(tabs)');
        // Reschedule the next occurrence
        syncFastSchedule();
      }
    });
    return () => subscription.remove();
  }, []);

  // Handle deep links from widget
  useEffect(() => {
    function handleURL(event: { url: string }) {
      const { hostname } = Linking.parse(event.url);
      if (hostname === 'timer' || hostname === 'start') {
        router.push('/(tabs)');
      }
    }

    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) handleURL({ url });
    });

    // Handle URLs while app is running
    const sub = Linking.addEventListener('url', handleURL);
    return () => sub.remove();
  }, []);

  // Push an initial widget snapshot on launch so the home-screen widget
  // has something to render before a fast is started.
  useEffect(() => {
    const activeFast = useFastingStore.getState().activeFast;
    const profile = useUserStore.getState().profile;
    const protocolLabel = profile?.preferred_protocol ?? '16:8';
    if (activeFast) {
      const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
      const phase = getCurrentPhase(elapsed);
      pushWidgetSnapshot({
        isActive: true,
        startedAt: activeFast.startedAt,
        targetHours: activeFast.targetHours,
        phase: phase.name,
        protocol: activeFast.protocol,
      });
    } else {
      pushWidgetSnapshot({
        isActive: false,
        startedAt: null,
        targetHours: 16,
        phase: 'Fed State',
        protocol: protocolLabel,
      });
    }
  }, []);

  useEffect(() => {
    try { initPostHog(); } catch (e) { console.warn('[RootLayout] PostHog init failed:', e); }
    try { trackAppLaunched(); } catch (e) { /* silent */ }

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
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? '#17110A' : '#FBF6EE',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={isDark ? '#E89B5C' : '#C8621B'} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            <View style={{ flex: 1 }}>
              <StatusBar style={isDark ? 'light' : 'dark'} />
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
                <Stack.Screen
                  name="fast-complete"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
              </Stack>
            </View>
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
