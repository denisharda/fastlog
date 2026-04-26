import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { FastingSession } from '../../types';
import { AmbientGlow, Card, CircleIcon, PrimaryButton } from '../ui';
import { PHASES, TABULAR, hexAlpha } from '../../constants/theme';
import { useHydration } from '../../hooks/useHydration';
import { trackPaywallViewed, trackFastMoodLogged } from '../../lib/posthog';
import { ShareCardPreviewSheet, ShareCardPreviewSheetRef } from '../share/ShareCardPreviewSheet';
import { MOODS, Mood } from '../../constants/moods';
import { upsertFastingNote } from '../../lib/fastingNotes';
import { fastingNoteQueryKey } from '../../hooks/useFastingNote';

export interface FastCompleteSheetRef {
  present: () => void;
  dismiss: () => void;
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const FastCompleteSheet = forwardRef<FastCompleteSheetRef>((_, ref) => {
  const theme = useTheme();
  const router = useRouter();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);
  const { todayTotalMl } = useHydration();
  const sheetRef = useRef<BottomSheetModal>(null);
  const shareSheetRef = useRef<ShareCardPreviewSheetRef>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [visible, setVisible] = useState(false);
  const queryClient = useQueryClient();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const { data: recentCompleted } = useQuery({
    queryKey: ['recent_completed_sessions', profile?.id],
    queryFn: async (): Promise<FastingSession[]> => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('fasting_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('completed', true)
        .order('ended_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as FastingSession[];
    },
    enabled: !!profile?.id && visible,
  });

  const session = recentCompleted?.[0] ?? null;

  // Reset mood + fire haptic each time the sheet presents.
  useEffect(() => {
    if (visible) {
      setMood(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible]);

  const durationMs = useMemo(() => {
    if (!session?.ended_at) return 0;
    return new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
  }, [session]);

  const actualHours = durationMs / 3600000;
  const autophagyMinutes = Math.max(0, Math.round((Math.min(actualHours, 18) - 16) * 60));

  const streak = useMemo(() => {
    if (!recentCompleted?.length) return 0;
    const days = new Set(
      recentCompleted
        .map(s => (s.ended_at ? new Date(s.ended_at).toISOString().split('T')[0] : null))
        .filter((d): d is string => Boolean(d)),
    );
    let count = 0;
    const cursor = new Date();
    while (days.has(cursor.toISOString().split('T')[0])) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [recentCompleted]);

  const handleSheetChange = useCallback((index: number) => {
    setVisible(index >= 0);
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
    ),
    [],
  );

  const handleSave = useCallback(() => {
    if (session && profile?.id && mood) {
      upsertFastingNote({ sessionId: session.id, userId: profile.id, mood })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: fastingNoteQueryKey(session.id) }),
        )
        .catch(e => console.warn('[fast-complete] mood save failed', e));
      trackFastMoodLogged({ mood, sessionId: session.id });
    }
    sheetRef.current?.dismiss();
  }, [session, profile?.id, mood, queryClient]);

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={useMemo(() => ['95%'], [])}
        onChange={handleSheetChange}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        handleComponent={null}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
          }}
        >
          <AmbientGlow
            color={theme.primary}
            alpha={theme.isDark ? 0x55 : 0x44}
            width={560}
            height={420}
            top={-180}
          />
          <AmbientGlow
            color={theme.phases[4]}
            alpha={theme.isDark ? 0x33 : 0x22}
            width={300}
            height={300}
            top={200}
            left={-80}
          />

          <View
            style={{
              paddingTop: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              justifyContent: 'flex-end',
            }}
          >
            <CircleIcon theme={theme} size={32} onPress={() => sheetRef.current?.dismiss()}>
              <Svg width={11} height={11} viewBox="0 0 11 11">
                <Path d="M1 1l9 9M10 1l-9 9" stroke={theme.textMuted} strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
            </CircleIcon>
          </View>

          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 14 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  overflow: 'hidden',
                  marginBottom: 18,
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.33,
                  shadowRadius: 30,
                  elevation: 10,
                }}
              >
                <LinearGradient
                  colors={[theme.primary, theme.phases[4]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                    <Path
                      d="M8 16l5 5 11-12"
                      stroke="#fff"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </LinearGradient>
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: theme.primary,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                Fast Complete
              </Text>
              <Text
                style={{
                  fontSize: 34,
                  fontWeight: '700',
                  color: theme.text,
                  letterSpacing: -1,
                  marginTop: 8,
                  lineHeight: 37,
                  textAlign: 'center',
                }}
              >
                Beautifully done.
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: theme.textMuted,
                  marginTop: 8,
                  maxWidth: 300,
                  textAlign: 'center',
                  lineHeight: 22,
                  letterSpacing: -0.1,
                }}
              >
                You reached every phase — including{' '}
                <Text style={{ color: theme.primary, fontWeight: '600' }}>
                  {autophagyMinutes > 0 ? `${autophagyMinutes} minutes of autophagy` : 'real metabolic work'}
                </Text>
                .
              </Text>
            </View>

            {/* Duration card */}
            <Card theme={theme} padding={20} style={{ marginTop: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 56,
                    fontWeight: '300',
                    color: theme.text,
                    letterSpacing: -2,
                    lineHeight: 58,
                    ...TABULAR,
                  }}
                >
                  {session ? formatDuration(durationMs) : '—'}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  height: 10,
                  borderRadius: 5,
                  overflow: 'hidden',
                  marginBottom: 10,
                }}
              >
                {PHASES.map((p, i) => (
                  <View
                    key={i}
                    style={{
                      flex: p.end === 24 ? 0.4 : p.end - p.start,
                      backgroundColor: theme.phases[i],
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: theme.textFaint,
                    letterSpacing: 0.3,
                    ...TABULAR,
                  }}
                >
                  {session ? formatTime(session.started_at) : '—'}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: theme.textFaint,
                    letterSpacing: 0.3,
                    ...TABULAR,
                  }}
                >
                  {session?.ended_at ? formatTime(session.ended_at) : '—'}
                </Text>
              </View>
            </Card>

            {/* Stats trio */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {[
                { l: 'Target', v: session ? `${session.target_hours}h` : '—', s: 'reached' },
                { l: 'Streak', v: String(streak), s: streak === 1 ? 'day' : 'days' },
                { l: 'Water', v: `${(todayTotalMl / 1000).toFixed(1)}`, s: 'liters' },
              ].map(s => (
                <View
                  key={s.l}
                  style={{
                    flex: 1,
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    padding: 12,
                    alignItems: 'center',
                    borderWidth: theme.isDark ? 0.5 : 0,
                    borderColor: theme.hairline,
                    shadowColor: '#2A1F14',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: theme.isDark ? 0 : 0.04,
                    shadowRadius: 2,
                    elevation: theme.isDark ? 0 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: theme.textFaint,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.l}
                  </Text>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '600',
                      color: theme.text,
                      letterSpacing: -0.4,
                      marginTop: 4,
                      ...TABULAR,
                    }}
                  >
                    {s.v}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textFaint, marginTop: 1 }}>{s.s}</Text>
                </View>
              ))}
            </View>

            {/* Mood check-in */}
            <Card theme={theme} padding={14} style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                How did it feel?
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                {MOODS.map(m => {
                  const isSel = mood === m.value;
                  return (
                    <Pressable
                      key={m.value}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setMood(m.value);
                      }}
                      style={{ alignItems: 'center', flex: 1 }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: isSel ? hexAlpha(theme.primary, 0x22) : theme.surface2,
                          borderWidth: 2,
                          borderColor: isSel ? theme.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: isSel ? '700' : '500',
                          color: isSel ? theme.primary : theme.textFaint,
                          marginTop: 4,
                          letterSpacing: 0.1,
                        }}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <View style={{ marginTop: 18 }}>
              <PrimaryButton theme={theme} onPress={handleSave}>
                Save to journal
              </PrimaryButton>
              <Pressable
                onPress={() => {
                  if (!session) return;
                  if (!isPro) {
                    trackPaywallViewed('share_card');
                    router.push('/paywall');
                    return;
                  }
                  shareSheetRef.current?.present({
                    session,
                    waterMl: todayTotalMl > 0 ? todayTotalMl : undefined,
                    source: 'fast_complete',
                  });
                }}
                style={{
                  paddingVertical: 10,
                  alignItems: 'center',
                  marginTop: 4,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {!isPro && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 }}>PRO</Text>
                )}
                <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textMuted }}>
                  Share this fast
                </Text>
              </Pressable>
            </View>
          </BottomSheetScrollView>
        </View>
      </BottomSheetModal>
      <ShareCardPreviewSheet ref={shareSheetRef} />
    </>
  );
});

FastCompleteSheet.displayName = 'FastCompleteSheet';
