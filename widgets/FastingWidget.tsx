/**
 * Home Screen Widget for FastLog
 *
 * Uses the official expo-widgets API with @expo/ui/swift-ui components.
 * Reads fasting state from App Groups shared UserDefaults.
 *
 * Sizes:
 * - Small: timer + phase name + progress text
 * - Medium: timer left, phase + protocol right
 *
 * Inactive state: app branding + protocol + "Tap to start"
 */

import { createWidget, WidgetEnvironment } from 'expo-widgets';
import { Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  background,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';

// Light theme — matches the app's design system
const COLORS = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  primary: '#2D6A4F',
  accent: '#40916C',
  textPrimary: '#1A1A1A',
  textMuted: '#6B7280',
};

// Phase thresholds matching constants/phases.ts
const PHASE_THRESHOLDS = [
  { name: 'Fed State', min: 0, max: 4 },
  { name: 'Early Fasting', min: 4, max: 8 },
  { name: 'Fat Burning Begins', min: 8, max: 12 },
  { name: 'Fat Burning Peak', min: 12, max: 16 },
  { name: 'Autophagy Zone', min: 16, max: 18 },
  { name: 'Deep Fast', min: 18, max: Infinity },
];

function computePhase(elapsedHours: number): string {
  const phase = PHASE_THRESHOLDS.find(
    (p) => elapsedHours >= p.min && elapsedHours < p.max
  );
  return phase?.name ?? 'Deep Fast';
}

interface FastingState {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
  elapsedHours: number;
}

function SmallWidget({ state }: { state: FastingState }) {
  if (!state.isActive || !state.startedAt) {
    return (
      <VStack
        modifiers={[
          background(COLORS.background),
          padding({ all: 16 }),
          widgetURL('fastlog://start'),
        ]}
      >
        <Text
          modifiers={[
            foregroundStyle(COLORS.primary),
            font({ size: 14, weight: 'bold' }),
          ]}
        >
          FastLog
        </Text>
        <Spacer />
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 12 }),
          ]}
        >
          {state.protocol} ready
        </Text>
        <Text
          modifiers={[
            foregroundStyle(COLORS.accent),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          Tap to start
        </Text>
      </VStack>
    );
  }

  // Compute phase locally from startedAt for freshness
  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 3600000;
  const phase = computePhase(elapsed);
  const progress = state.targetHours > 0
    ? Math.min(Math.round((elapsed / state.targetHours) * 100), 100)
    : 0;

  return (
    <VStack
      modifiers={[
        background(COLORS.background),
        padding({ all: 16 }),
        widgetURL('fastlog://timer'),
      ]}
    >
      <Text
        modifiers={[
          foregroundStyle(COLORS.accent),
          font({ size: 12, weight: 'medium' }),
        ]}
      >
        {phase}
      </Text>
      <Spacer />
      <Text
        date={new Date(state.startedAt)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle(COLORS.textPrimary),
          font({ size: 28, weight: 'bold', design: 'monospaced' }),
        ]}
      />
      <Text
        modifiers={[
          foregroundStyle(COLORS.textMuted),
          font({ size: 12 }),
        ]}
      >
        {progress}% of {state.targetHours}h goal
      </Text>
    </VStack>
  );
}

function MediumWidget({ state }: { state: FastingState }) {
  if (!state.isActive || !state.startedAt) {
    return (
      <HStack
        modifiers={[
          background(COLORS.background),
          padding({ all: 16 }),
          widgetURL('fastlog://start'),
        ]}
      >
        <VStack>
          <Text
            modifiers={[
              foregroundStyle(COLORS.primary),
              font({ size: 16, weight: 'bold' }),
            ]}
          >
            FastLog
          </Text>
          <Spacer />
          <Text
            modifiers={[
              foregroundStyle(COLORS.textMuted),
              font({ size: 13 }),
            ]}
          >
            {state.protocol} protocol ready
          </Text>
          <Text
            modifiers={[
              foregroundStyle(COLORS.accent),
              font({ size: 14, weight: 'semibold' }),
            ]}
          >
            Tap to start fasting
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing">
          <Text
            modifiers={[
              foregroundStyle(COLORS.primary),
              font({ size: 36, weight: 'bold' }),
            ]}
          >
            {state.targetHours > 0 ? `${state.targetHours}h` : '16h'}
          </Text>
          <Text
            modifiers={[
              foregroundStyle(COLORS.textMuted),
              font({ size: 11 }),
            ]}
          >
            fast duration
          </Text>
        </VStack>
      </HStack>
    );
  }

  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 3600000;
  const phase = computePhase(elapsed);
  const progress = state.targetHours > 0
    ? Math.min(Math.round((elapsed / state.targetHours) * 100), 100)
    : 0;

  return (
    <HStack
      modifiers={[
        background(COLORS.background),
        padding({ all: 16 }),
        widgetURL('fastlog://timer'),
      ]}
    >
      {/* Left: Timer */}
      <VStack>
        <Text
          date={new Date(state.startedAt)}
          dateStyle="timer"
          modifiers={[
            foregroundStyle(COLORS.textPrimary),
            font({ size: 32, weight: 'bold', design: 'monospaced' }),
          ]}
        />
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 12 }),
          ]}
        >
          {progress}% of {state.targetHours}h ({state.protocol})
        </Text>
      </VStack>
      <Spacer />
      {/* Right: Phase */}
      <VStack alignment="trailing">
        <Text
          modifiers={[
            foregroundStyle(COLORS.accent),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          {phase}
        </Text>
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 12 }),
          ]}
        >
          {state.protocol}
        </Text>
      </VStack>
    </HStack>
  );
}

function FastingWidgetComponent(props: FastingState, env: WidgetEnvironment) {
  'widget';

  return env.widgetFamily === 'systemSmall' ? (
    <SmallWidget state={props} />
  ) : (
    <MediumWidget state={props} />
  );
}

export default createWidget('FastingWidget', FastingWidgetComponent);
