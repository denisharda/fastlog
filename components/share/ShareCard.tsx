import { forwardRef, useMemo } from 'react';
import { View, Text } from 'react-native';
import { FastingSession } from '../../types';
import { PhaseRing } from '../ui/PhaseRing';
import { getCurrentPhase, TABULAR, Theme } from '../../constants/theme';

export const SHARE_CARD_SIZE = 360;
const RING_SIZE = 220;
const PADDING = 32;

interface ShareCardProps {
  session: FastingSession;
  waterMl?: number;
  theme: Theme;
  /** Override "now" for in-progress sessions (tests / stable capture). Defaults to Date.now(). */
  now?: number;
}

function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatEyebrow(session: FastingSession): string {
  const d = new Date(session.started_at);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const prefix = session.ended_at ? session.protocol : `In progress · ${session.protocol}`;
  return `${prefix} · ${date}`.toUpperCase();
}

/**
 * 1:1 square share card. Purely presentational — no side effects.
 * forwardRef so parent can capture this view with react-native-view-shot.
 */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { session, waterMl, theme, now },
  ref,
) {
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : (now ?? Date.now());
  const elapsedMs = endMs - new Date(session.started_at).getTime();
  const elapsedHours = elapsedMs / 3600000;
  const phase = useMemo(() => getCurrentPhase(elapsedHours), [elapsedHours]);
  const eyebrow = useMemo(() => formatEyebrow(session), [session]);
  const elapsedLabel = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: SHARE_CARD_SIZE,
        height: SHARE_CARD_SIZE,
        padding: PADDING,
        backgroundColor: theme.bg,
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          color: theme.textFaint,
        }}
      >
        {eyebrow}
      </Text>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <PhaseRing
            size={RING_SIZE}
            stroke={12}
            hours={Math.min(elapsedHours, 24)}
            target={session.target_hours}
            theme={theme}
            showTicks={false}
            animated={false}
          />
          <View
            style={{
              position: 'absolute',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 44,
                fontWeight: '700',
                letterSpacing: -1.5,
                color: theme.text,
                ...TABULAR,
              }}
            >
              {elapsedLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.primary, letterSpacing: -0.4 }}>
          {phase.name}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: theme.textMuted,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          {phase.description}
        </Text>
        {waterMl !== undefined && waterMl > 0 && (
          <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>
            💧 {(waterMl / 1000).toFixed(1)}L water
          </Text>
        )}
      </View>

      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          color: theme.textFaint,
          textAlign: 'center',
        }}
      >
        FASTLOG
      </Text>
    </View>
  );
});
