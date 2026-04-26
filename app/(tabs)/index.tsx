import { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFasting } from '../../hooks/useFasting';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/userStore';
import { useFastingStore } from '../../stores/fastingStore';
import { FastingProtocol } from '../../types';
import { PHASES, PHASE_SUBLINES, getPhaseIndex, hexAlpha, TABULAR } from '../../constants/theme';
import { AmbientGlow, PhaseRing, PrimaryButton, PillRow, Card, CircleIcon, PillItem, PhaseDetailSheet } from '../../components/ui';
import { CUSTOM_PROTOCOL_MIN_HOURS, CUSTOM_PROTOCOL_MAX_HOURS } from '../../constants/protocols';
import { trackPaywallViewed } from '../../lib/posthog';
import { TAB_BAR_HEIGHT } from '../../components/ui/TabBar';
import Svg, { Circle, Path } from 'react-native-svg';

const PROTOCOL_ITEMS: (PillItem<FastingProtocol> & { hours: number })[] = [
  { value: '16:8', label: '16:8', hours: 16 },
  { value: '18:6', label: '18:6', hours: 18 },
  { value: '24h', label: '24h', hours: 24 },
  { value: 'custom', label: 'Custom', hours: 20, badge: 'PRO' },
];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatStarted(date: Date, now: Date): string {
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Started ${time} · Today`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Started ${time} · Yesterday`;
  return `Started ${time} · ${date.toLocaleDateString(undefined, { weekday: 'long' })}`;
}

function formatToday(now: Date): string {
  return now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDurationHM(hours: number): string {
  const totalMin = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatFastWindow(start: Date, hours: number): string {
  const end = new Date(start.getTime() + hours * 3600 * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric' });
  const sameDay = start.toDateString() === end.toDateString();
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endsTomorrow = end.toDateString() === tomorrow.toDateString();
  const suffix = sameDay ? '' : endsTomorrow ? ' tomorrow' : '';
  return `${fmt(start)} – ${fmt(end)}${suffix}`;
}

export default function TimerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPro = useUserStore(s => s.isPro);
  const hasSeenSuccessPaywall = useUserStore(s => s.hasSeenSuccessPaywall);
  const setHasSeenSuccessPaywall = useUserStore(s => s.setHasSeenSuccessPaywall);
  const activeFast = useFastingStore(s => s.activeFast);

  const {
    isActive,
    elapsedSeconds,
    elapsedHours,
    progressRatio,
    currentPhase,
    targetHours,
    startFast,
    stopFast,
    isLoading,
    error,
  } = useFasting();

  const [selectedProtocol, setSelectedProtocol] = useState<FastingProtocol>('16:8');
  const [customHours, setCustomHours] = useState(CUSTOM_PROTOCOL_MIN_HOURS);
  const [phaseSheetVisible, setPhaseSheetVisible] = useState(false);

  const selectedItem = PROTOCOL_ITEMS.find(p => p.value === selectedProtocol) ?? PROTOCOL_ITEMS[0];
  const selectedHours = selectedProtocol === 'custom' ? customHours : selectedItem.hours;

  const activePhaseIdx = getPhaseIndex(elapsedHours);
  const phaseColor = theme.phases[activePhaseIdx];
  const primaryBtnColor = isActive ? phaseColor : theme.primary;

  const nextPhase = PHASES[activePhaseIdx + 1];
  const hoursUntilNext = nextPhase ? Math.max(0, nextPhase.start - elapsedHours) : 0;

  const startedAt = activeFast ? new Date(activeFast.startedAt) : null;
  const now = new Date();

  const handleProtocolChange = useCallback((v: FastingProtocol) => {
    if (v === 'custom' && !isPro) {
      trackPaywallViewed('custom_protocol');
      router.push('/paywall');
      return;
    }
    setSelectedProtocol(v);
  }, [isPro, router]);

  const handleStart = useCallback(async () => {
    await startFast(selectedProtocol, selectedHours);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedProtocol, selectedHours, startFast]);

  const handleStop = useCallback(() => {
    if (progressRatio >= 1) {
      Alert.alert('Complete Fast?', 'Beautifully done. Ready to finish this fast?', [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            await stopFast(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // /fast-complete is now surfaced by the layout effect that
            // watches lastEndedSessionId — see app/_layout.tsx.
            if (!isPro && !hasSeenSuccessPaywall) {
              setHasSeenSuccessPaywall(true);
            }
          },
        },
      ]);
    } else {
      Alert.alert('End Fast Early?', "Your streak resets. Are you sure you want to stop?", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Fast',
          style: 'destructive',
          onPress: async () => {
            await stopFast(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    }
  }, [progressRatio, stopFast, router, isPro, hasSeenSuccessPaywall, setHasSeenSuccessPaywall]);

  const ctaLabel = isActive
    ? progressRatio >= 1
      ? 'Complete Fast'
      : 'Stop Fasting'
    : `Start ${selectedProtocol === 'custom' ? `${customHours}h` : selectedProtocol} Fast`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AmbientGlow color={phaseColor} alpha={theme.isDark ? 0x44 : 0x55} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: theme.textFaint,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {isActive ? 'Fasting' : 'Today'}
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: theme.text,
              letterSpacing: -0.3,
              marginTop: 2,
            }}
          >
            {isActive && startedAt ? formatStarted(startedAt, now) : formatToday(now)}
          </Text>
        </View>
        <CircleIcon theme={theme} size={40} onPress={() => router.push('/(tabs)/history')}>
          <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
            <Circle cx={9} cy={9} r={7} stroke={theme.textMuted} strokeWidth={1.4} fill="none" />
            <Path
              d="M9 5v4l2.5 1.5"
              stroke={theme.textMuted}
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </CircleIcon>
      </View>

      {/* Ring + digits */}
      <View style={{ marginTop: 22, alignItems: 'center', justifyContent: 'center' }}>
        <PhaseRing size={320} stroke={16} hours={elapsedHours} target={isActive ? targetHours : selectedHours} theme={theme} />
        <View style={{ position: 'absolute', width: 320, height: 320, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 2,
              color: isActive ? phaseColor : theme.textFaint,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            {isActive ? currentPhase.name : 'Ready to start'}
          </Text>
          <Text
            style={{
              fontSize: 52,
              fontWeight: '300',
              color: theme.text,
              letterSpacing: -2,
              lineHeight: 56,
              ...TABULAR,
            }}
          >
            {isActive ? formatDuration(elapsedSeconds) : '00:00:00'}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: theme.textMuted,
              marginTop: 10,
              letterSpacing: -0.1,
              ...TABULAR,
            }}
          >
            {isActive
              ? `${elapsedHours.toFixed(1)}h of ${targetHours}h · ${Math.round(progressRatio * 100)}%`
              : `Target · ${selectedHours}h fast`}
          </Text>
        </View>
      </View>

      {/* Info cards (active) or protocol chips (idle) */}
      {isActive ? (
        <View style={{ marginTop: 26, paddingHorizontal: 16, flexDirection: 'row', gap: 10 }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              Haptics.selectionAsync();
              setPhaseSheetVisible(true);
            }}
          >
            <Card theme={theme} padding={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textFaint, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Phase
                </Text>
                <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                  <Path
                    d="M1 1l5 5-5 5"
                    stroke={theme.textFaint}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '600', color: theme.text, marginTop: 4, letterSpacing: -0.3 }}>
                {currentPhase.name}
              </Text>
              <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
                {PHASE_SUBLINES[currentPhase.name as keyof typeof PHASE_SUBLINES]}
              </Text>
            </Card>
          </Pressable>
          <Card theme={theme} padding={14} style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textFaint, letterSpacing: 1, textTransform: 'uppercase' }}>
              Progress
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: '600', color: theme.text, letterSpacing: -0.5, ...TABULAR }}>
                {Math.round(progressRatio * 100)}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted }}>%</Text>
            </View>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.hairline,
                marginTop: 6,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.round(progressRatio * 100)}%`,
                  height: '100%',
                  backgroundColor: phaseColor,
                  borderRadius: 2,
                }}
              />
            </View>
          </Card>
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          <PillRow
            theme={theme}
            items={PROTOCOL_ITEMS}
            value={selectedProtocol}
            onChange={handleProtocolChange}
          />
          {selectedProtocol === 'custom' && isPro && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                marginTop: 14,
              }}
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCustomHours(h => Math.max(CUSTOM_PROTOCOL_MIN_HOURS, h - 1));
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 0.5,
                  borderColor: theme.hairline,
                }}
              >
                <Text style={{ fontSize: 22, color: theme.text, fontWeight: '500' }}>−</Text>
              </Pressable>
              <View
                style={{
                  paddingHorizontal: 20,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 0.5,
                  borderColor: theme.hairline,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text, ...TABULAR }}>{customHours}h</Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCustomHours(h => Math.min(CUSTOM_PROTOCOL_MAX_HOURS, h + 1));
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 0.5,
                  borderColor: theme.hairline,
                }}
              >
                <Text style={{ fontSize: 22, color: theme.text, fontWeight: '500' }}>+</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {error ? (
        <Text style={{ color: theme.danger, fontSize: 13, textAlign: 'center', marginTop: 12 }}>{error}</Text>
      ) : null}

      {/* Primary action + hint */}
      <View style={{ marginTop: 'auto', paddingHorizontal: 16, paddingBottom: TAB_BAR_HEIGHT + 20 }}>
        <PrimaryButton
          theme={theme}
          color={primaryBtnColor}
          onPress={isActive ? handleStop : handleStart}
          loading={isLoading}
        >
          {ctaLabel}
        </PrimaryButton>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '500',
            color: theme.textFaint,
            textAlign: 'center',
            marginTop: 10,
            letterSpacing: -0.1,
          }}
        >
          {isActive
            ? hoursUntilNext > 0 && nextPhase
              ? `${formatDurationHM(hoursUntilNext)} until ${nextPhase.name.toLowerCase()}`
              : 'You reached every phase — beautifully done.'
            : `Tap to start · ${formatFastWindow(now, selectedHours)}`}
        </Text>
      </View>

      <PhaseDetailSheet
        visible={phaseSheetVisible}
        phase={currentPhase}
        phaseColor={phaseColor}
        theme={theme}
        onClose={() => setPhaseSheetVisible(false)}
      />
    </View>
  );
}
