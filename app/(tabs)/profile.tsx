import { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '../../stores/userStore';
import { useFastingStore } from '../../stores/fastingStore';
import { useHydrationStore } from '../../stores/hydrationStore';
import { useHydration } from '../../hooks/useHydration';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { restorePurchases, getProRenewalDate } from '../../lib/revenuecat';
import {
  trackPaywallViewed,
  trackWaterGoalChanged,
  trackProtocolChanged,
} from '../../lib/posthog';
import { syncFastSchedule } from '../../lib/fastScheduler';
import { formatScheduleSubtitle } from '../../lib/scheduleFormat';
import { FastScheduleSheet, FastScheduleSheetRef } from '../../components/profile/FastScheduleSheet';
import { PROTOCOL_LIST } from '../../constants/protocols';
import {
  MIN_DAILY_WATER_GOAL_ML,
  MAX_DAILY_WATER_GOAL_ML,
  WATER_GOAL_STEP_ML,
} from '../../constants/hydration';
import { Card, ScreenHeader, Toggle } from '../../components/ui';
import { TABULAR, hexAlpha } from '../../constants/theme';
import { FastingProtocol } from '../../types';
import { TAB_BAR_HEIGHT } from '../../components/ui/TabBar';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);
  const setIsPro = useUserStore(s => s.setIsPro);
  const setPreferredProtocol = useUserStore(s => s.setPreferredProtocol);
  const schedule = useUserStore(s => s.fastSchedule);
  const setSchedule = useUserStore(s => s.setFastSchedule);
  const notificationPrefs = useUserStore(s => s.notificationPrefs);
  const setNotificationPrefs = useUserStore(s => s.setNotificationPrefs);
  const resetUser = useUserStore(s => s.reset);

  const { dailyGoalMl, setDailyGoal } = useHydration();
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const scheduleSheetRef = useRef<FastScheduleSheetRef>(null);

  const { data: fastsLogged = 0 } = useQuery({
    queryKey: ['fasting_sessions_count', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      const { count } = await supabase
        .from('fasting_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('completed', true);
      return count ?? 0;
    },
    enabled: !!profile?.id,
  });

  const { data: renewalIso } = useQuery({
    queryKey: ['pro_renewal_date', isPro],
    queryFn: getProRenewalDate,
    enabled: isPro,
  });

  const accountMeta = isPro
    ? renewalIso
      ? `Renews ${new Date(renewalIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : 'Pro plan active'
    : `${fastsLogged} ${fastsLogged === 1 ? 'fast' : 'fasts'} logged`;

  const initials =
    (profile?.name ?? 'F')
      .split(' ')
      .map(n => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'F';

  async function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    resetUser();
    useFastingStore.getState().stopFast();
    useHydrationStore.setState({
      todayLogs: [],
      lastResetDate: new Date().toISOString().split('T')[0],
    });
  }

  async function handleRestore() {
    setRestoringPurchases(true);
    await restorePurchases();
    setRestoringPurchases(false);
  }

  function updateProtocol(next: FastingProtocol) {
    if (!profile || profile.preferred_protocol === next) return;
    Haptics.selectionAsync();
    trackProtocolChanged({ old_protocol: profile.preferred_protocol ?? '', new_protocol: next });
    setPreferredProtocol(next);
    supabase
      .from('profiles')
      .update({ preferred_protocol: next })
      .eq('id', profile.id)
      .then(({ error }) => {
        if (error) console.error('[Profile] Protocol update failed:', error);
      });
  }

  function updateWaterGoal(delta: number) {
    const next = dailyGoalMl + delta;
    if (next < MIN_DAILY_WATER_GOAL_ML || next > MAX_DAILY_WATER_GOAL_ML) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackWaterGoalChanged({ old_goal_ml: dailyGoalMl, new_goal_ml: next });
    setDailyGoal(next);
    if (profile) {
      supabase
        .from('profiles')
        .update({ daily_water_goal_ml: next })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) console.error('[Profile] Water goal update failed:', error);
        });
    }
  }

  function toggleSchedule(on: boolean) {
    if (!isPro && on) {
      trackPaywallViewed('fast_schedule');
      router.push('/paywall');
      return;
    }
    if (on) {
      scheduleSheetRef.current?.present();
    } else {
      setSchedule(null);
      syncFastSchedule();
    }
  }

  function openScheduleSheet() {
    if (!isPro) {
      trackPaywallViewed('fast_schedule');
      router.push('/paywall');
      return;
    }
    scheduleSheetRef.current?.present();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader theme={theme} title="Profile" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account card */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/edit-profile');
          }}
          style={{ marginTop: 6 }}
        >
          <Card theme={theme} padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <AvatarGradient initials={initials} theme={theme} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 19, fontWeight: '600', color: theme.text, letterSpacing: -0.3 }}>
                  {profile?.name ?? 'Faster'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: isPro ? theme.primary : theme.surface2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                        color: isPro ? '#FFFFFF' : theme.textMuted,
                      }}
                    >
                      {isPro ? 'PRO' : 'FREE'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: theme.textMuted }}>{accountMeta}</Text>
                </View>
              </View>
              <Svg width={8} height={14} viewBox="0 0 8 14">
                <Path
                  d="M1 1l6 6-6 6"
                  stroke={theme.textFaint}
                  strokeWidth={1.8}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </Card>
        </Pressable>

        {/* Upgrade banner (free only) */}
        {!isPro && (
          <Pressable
            onPress={() => {
              trackPaywallViewed('profile_banner');
              router.push('/paywall');
            }}
            style={{
              marginTop: 14,
              borderRadius: 20,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 30,
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={[theme.primary, theme.phases[4]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 18,
                paddingHorizontal: 18,
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  right: -30,
                  top: -30,
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 10,
                  bottom: -40,
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.75)',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                FastLog Pro
              </Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '600',
                  color: '#FFFFFF',
                  letterSpacing: -0.5,
                  marginTop: 6,
                  maxWidth: '85%',
                }}
              >
                Go deeper with your fasting story
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary, letterSpacing: -0.1 }}>
                  Start free trial →
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Fasting */}
        <SectionLabel theme={theme}>Fasting</SectionLabel>
        <Card theme={theme} padding={0}>
          <View style={{ padding: 14, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: theme.hairline }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                Default protocol
              </Text>
              <Text style={{ fontSize: 13, color: theme.textMuted }}>
                Currently {profile?.preferred_protocol ?? '16:8'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {PROTOCOL_LIST.filter(p => p.id !== 'custom').map(p => {
                const active = profile?.preferred_protocol === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => updateProtocol(p.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      alignItems: 'center',
                      borderRadius: 10,
                      backgroundColor: active ? theme.text : theme.surface2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: active ? theme.bg : theme.textMuted,
                        letterSpacing: -0.1,
                        ...TABULAR,
                      }}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={openScheduleSheet}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              paddingHorizontal: 16,
              borderBottomWidth: 0.5,
              borderBottomColor: theme.hairline,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                Fast schedule
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                {formatScheduleSubtitle(schedule)}
              </Text>
            </View>
            {!isPro && (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 5,
                  backgroundColor: hexAlpha(theme.accent, 0x22),
                  marginRight: 10,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.accent, letterSpacing: 0.5 }}>PRO</Text>
              </View>
            )}
            <Toggle theme={theme} on={!!schedule?.enabled} onChange={toggleSchedule} />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                Phase notifications
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                Gentle alert when you enter a new zone
              </Text>
            </View>
            <Toggle
              theme={theme}
              on={notificationPrefs.phaseTransitions}
              onChange={v => setNotificationPrefs({ phaseTransitions: v })}
            />
          </View>
        </Card>

        {/* Hydration */}
        <SectionLabel theme={theme}>Hydration</SectionLabel>
        <Card theme={theme} padding={16}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                Daily water goal
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                Adjust to your body
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: theme.surface2,
                borderRadius: 14,
                padding: 4,
              }}
            >
              <Pressable
                onPress={() => updateWaterGoal(-WATER_GOAL_STEP_ML)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={10} height={2} viewBox="0 0 10 2">
                  <Path d="M0 1h10" stroke={theme.textMuted} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </Pressable>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.text,
                  minWidth: 70,
                  textAlign: 'center',
                  letterSpacing: -0.2,
                  ...TABULAR,
                }}
              >
                {dailyGoalMl.toLocaleString()} ml
              </Text>
              <Pressable
                onPress={() => updateWaterGoal(WATER_GOAL_STEP_ML)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  backgroundColor: theme.water,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={10} height={10} viewBox="0 0 10 10">
                  <Path d="M5 1v8M1 5h8" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
          </View>
        </Card>

        {__DEV__ && (
          <Card theme={theme} padding={14} style={{ marginTop: 14 }}>
            <Pressable
              onPress={() => setIsPro(!isPro)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ color: theme.text, fontWeight: '500' }}>Pro Status (Dev Toggle)</Text>
              <Text style={{ color: isPro ? theme.primary : theme.danger, fontWeight: '700' }}>
                {isPro ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </Card>
        )}

        {/* Account */}
        <SectionLabel theme={theme}>Account</SectionLabel>
        <Card theme={theme} padding={0}>
          <AccountRow theme={theme} label="Restore Purchases" onPress={handleRestore} loading={restoringPurchases} />
          <AccountRow theme={theme} label="Help & Support" onPress={() => {}} />
          <AccountRow theme={theme} label="Sign Out" onPress={handleSignOut} danger last />
        </Card>

        <Text
          style={{
            textAlign: 'center',
            paddingVertical: 14,
            fontSize: 11,
            color: theme.textFaint,
            letterSpacing: 0.3,
          }}
        >
          FastLog · v2.4.0
        </Text>
      </ScrollView>
      <FastScheduleSheet ref={scheduleSheetRef} />
    </View>
  );
}

function SectionLabel({ theme, children }: { theme: ReturnType<typeof useTheme>; children: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: '600',
        color: theme.textFaint,
        letterSpacing: 1,
        textTransform: 'uppercase',
        paddingHorizontal: 4,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

function AvatarGradient({ initials, theme }: { initials: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <LinearGradient
      colors={[theme.primary, theme.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '600', letterSpacing: -0.5 }}>{initials}</Text>
    </LinearGradient>
  );
}

function AccountRow({
  theme,
  label,
  onPress,
  loading,
  danger,
  last,
}: {
  theme: ReturnType<typeof useTheme>;
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: theme.hairline,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '500',
          color: danger ? theme.danger : theme.text,
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator color={theme.textMuted} />
      ) : danger ? null : (
        <Svg width={7} height={12} viewBox="0 0 7 12">
          <Path
            d="M1 1l5 5-5 5"
            stroke={theme.textFaint}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </Pressable>
  );
}
