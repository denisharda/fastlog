/**
 * Home Screen Widget for FastLog — Phase Ring Forward design.
 *
 * Renders a phase-tinted circular progress gauge with the timer in the
 * center. Small (158×158) and medium (338×158) families. Adapts to
 * system appearance (light/dark).
 *
 * Colour palette is mirrored from constants/theme.ts — keep in sync.
 * The 'widget' directive below isolates this tree from RN runtime APIs.
 */

import { createWidget, WidgetEnvironment } from 'expo-widgets';
import { Text, VStack, HStack, ZStack, Spacer, Gauge, Circle } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  frame,
  opacity,
  widgetURL,
  gaugeStyle,
  tint,
  background,
} from '@expo/ui/swift-ui/modifiers';

interface WidgetPalette {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primarySoft: string;
  accent: string;
  trackEmpty: string;
  phases: readonly [string, string, string, string, string, string];
}

const WIDGET_COLORS: { light: WidgetPalette; dark: WidgetPalette } = {
  light: {
    bg: '#FBF6EE',
    surface: '#FFFFFF',
    surface2: '#F5EEE2',
    text: '#2A1F14',
    textMuted: '#6B5A44',
    textFaint: '#A8957A',
    primary: '#C8621B',
    primarySoft: '#E89B5C',
    accent: '#D89B2B',
    trackEmpty: '#F0E3CA',
    phases: ['#E8C89A', '#E6A86B', '#D88845', '#C8621B', '#A04418', '#6B2A12'],
  },
  dark: {
    bg: '#17110A',
    surface: '#221A10',
    surface2: '#2B2115',
    text: '#FBF3E3',
    textMuted: '#C9B590',
    textFaint: '#7A6B54',
    primary: '#E89B5C',
    primarySoft: '#C8621B',
    accent: '#EDBC52',
    trackEmpty: '#2B2115',
    phases: ['#6B5232', '#9C7341', '#C8894A', '#E89B5C', '#F0B878', '#F8D9A8'],
  },
};

// Phase thresholds — MUST mirror constants/phases.ts ordering.
const PHASE_THRESHOLDS = [
  { name: 'Fed State', min: 0, max: 4 },
  { name: 'Early Fasting', min: 4, max: 8 },
  { name: 'Fat Burning Begins', min: 8, max: 12 },
  { name: 'Fat Burning Peak', min: 12, max: 16 },
  { name: 'Autophagy Zone', min: 16, max: 18 },
  { name: 'Deep Fast', min: 18, max: Infinity },
] as const;

function phaseIndex(elapsedHours: number): number {
  for (let i = PHASE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (elapsedHours >= PHASE_THRESHOLDS[i].min) return i;
  }
  return 0;
}

function phaseName(idx: number): string {
  return PHASE_THRESHOLDS[idx].name;
}

export interface FastingState {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
}

function SmallWidget({ state, palette }: { state: FastingState; palette: WidgetPalette }) {
  if (!state.isActive || !state.startedAt) {
    return <SmallInactive state={state} palette={palette} />;
  }

  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 3600000;
  const idx = phaseIndex(elapsed);
  const ringColor = palette.phases[idx];
  const progress = state.targetHours > 0
    ? Math.min(Math.max(elapsed / state.targetHours, 0), 1)
    : 0;
  const percent = Math.round(progress * 100);
  const phase = phaseName(idx);

  return (
    <VStack
      modifiers={[
        padding({ all: 14 }),
        background(palette.bg),
        widgetURL('fastlog://timer'),
      ]}
    >
      <HStack>
        <Text
          modifiers={[
            foregroundStyle(palette.accent),
            font({ size: 10, weight: 'bold' }),
          ]}
        >
          {phase.toUpperCase()}
        </Text>
        <Spacer />
      </HStack>

      <Spacer />

      <Gauge
        value={progress}
        min={0}
        max={1}
        modifiers={[
          gaugeStyle('circularCapacity'),
          tint(ringColor),
          frame({ width: 84, height: 84 }),
        ]}
        currentValueLabel={
          <VStack>
            <Text
              date={new Date(state.startedAt)}
              dateStyle="timer"
              modifiers={[
                foregroundStyle(palette.text),
                font({ size: 16, weight: 'bold', design: 'monospaced' }),
              ]}
            />
            <Text
              modifiers={[
                foregroundStyle(palette.textMuted),
                font({ size: 9 }),
              ]}
            >
              of {state.targetHours}h
            </Text>
          </VStack>
        }
      />

      <Spacer />

      <Text
        modifiers={[
          foregroundStyle(palette.textMuted),
          font({ size: 11 }),
        ]}
      >
        {percent}% · {state.protocol}
      </Text>
    </VStack>
  );
}

function SmallInactive({ state, palette }: { state: FastingState; palette: WidgetPalette }) {
  return (
    <VStack
      modifiers={[
        padding({ all: 14 }),
        background(palette.bg),
        widgetURL('fastlog://start'),
      ]}
    >
      <HStack>
        <Text
          modifiers={[
            foregroundStyle(palette.accent),
            font({ size: 10, weight: 'bold' }),
          ]}
        >
          READY
        </Text>
        <Spacer />
      </HStack>

      <Spacer />

      <ZStack modifiers={[frame({ width: 84, height: 84 })]}>
        <Circle
          modifiers={[
            foregroundStyle(palette.trackEmpty),
            opacity(0.6),
            frame({ width: 84, height: 84 }),
          ]}
        />
        <VStack>
          <Text
            modifiers={[
              foregroundStyle(palette.primary),
              font({ size: 22, weight: 'bold' }),
            ]}
          >
            {state.targetHours > 0 ? `${state.targetHours}h` : '16h'}
          </Text>
          <Text
            modifiers={[
              foregroundStyle(palette.textMuted),
              font({ size: 9 }),
            ]}
          >
            protocol
          </Text>
        </VStack>
      </ZStack>

      <Spacer />

      <HStack>
        <Spacer />
        <Text
          modifiers={[
            foregroundStyle('#FFFFFF'),
            font({ size: 10, weight: 'semibold' }),
            padding({ horizontal: 10, vertical: 5 }),
            background(palette.primary),
          ]}
        >
          Tap to start
        </Text>
        <Spacer />
      </HStack>
    </VStack>
  );
}

function MediumWidget({ state, palette }: { state: FastingState; palette: WidgetPalette }) {
  if (!state.isActive || !state.startedAt) {
    return <MediumInactive state={state} palette={palette} />;
  }

  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 3600000;
  const idx = phaseIndex(elapsed);
  const ringColor = palette.phases[idx];
  const progress = state.targetHours > 0
    ? Math.min(Math.max(elapsed / state.targetHours, 0), 1)
    : 0;
  const percent = Math.round(progress * 100);
  const endAt = new Date(new Date(state.startedAt).getTime() + state.targetHours * 3600000);
  const endLabel = endAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const phase = phaseName(idx);

  return (
    <HStack
      modifiers={[
        padding({ all: 16 }),
        background(palette.bg),
        widgetURL('fastlog://timer'),
      ]}
    >
      <Gauge
        value={progress}
        min={0}
        max={1}
        modifiers={[
          gaugeStyle('circularCapacity'),
          tint(ringColor),
          frame({ width: 120, height: 120 }),
        ]}
        currentValueLabel={
          <VStack>
            <Text
              date={new Date(state.startedAt)}
              dateStyle="timer"
              modifiers={[
                foregroundStyle(palette.text),
                font({ size: 24, weight: 'bold', design: 'monospaced' }),
              ]}
            />
            <Text
              modifiers={[
                foregroundStyle(palette.textMuted),
                font({ size: 10 }),
              ]}
            >
              of {state.targetHours}h
            </Text>
          </VStack>
        }
      />

      <Spacer />

      <VStack>
        <Text
          modifiers={[
            foregroundStyle(palette.accent),
            font({ size: 10, weight: 'bold' }),
          ]}
        >
          {phase.toUpperCase()}
        </Text>
        <Text
          modifiers={[
            foregroundStyle(palette.text),
            font({ size: 13, weight: 'semibold' }),
          ]}
        >
          {percent}% · {state.protocol}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            foregroundStyle(palette.textFaint),
            font({ size: 10 }),
          ]}
        >
          ENDS AT
        </Text>
        <Text
          modifiers={[
            foregroundStyle(palette.text),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          {endLabel}
        </Text>
      </VStack>
    </HStack>
  );
}

function MediumInactive({ state, palette }: { state: FastingState; palette: WidgetPalette }) {
  const targetHours = state.targetHours > 0 ? state.targetHours : 16;
  const protocolLabel = state.protocol || '16:8';

  return (
    <HStack
      modifiers={[
        padding({ all: 16 }),
        background(palette.bg),
        widgetURL('fastlog://start'),
      ]}
    >
      <ZStack modifiers={[frame({ width: 120, height: 120 })]}>
        <Circle
          modifiers={[
            foregroundStyle(palette.trackEmpty),
            opacity(0.6),
            frame({ width: 120, height: 120 }),
          ]}
        />
        <VStack>
          <Text
            modifiers={[
              foregroundStyle(palette.primary),
              font({ size: 28, weight: 'bold' }),
            ]}
          >
            {targetHours}h
          </Text>
          <Text
            modifiers={[
              foregroundStyle(palette.textMuted),
              font({ size: 10 }),
            ]}
          >
            protocol
          </Text>
        </VStack>
      </ZStack>

      <Spacer />

      <VStack>
        <Text
          modifiers={[
            foregroundStyle(palette.accent),
            font({ size: 10, weight: 'bold' }),
          ]}
        >
          FASTLOG
        </Text>
        <Text
          modifiers={[
            foregroundStyle(palette.text),
            font({ size: 15, weight: 'semibold' }),
          ]}
        >
          Ready when you are
        </Text>
        <Text
          modifiers={[
            foregroundStyle(palette.textMuted),
            font({ size: 11 }),
          ]}
        >
          {protocolLabel} · tap to start
        </Text>
        <Spacer />
        <Text
          modifiers={[
            foregroundStyle('#FFFFFF'),
            font({ size: 10, weight: 'semibold' }),
            padding({ horizontal: 10, vertical: 5 }),
            background(palette.primary),
          ]}
        >
          Tap to start
        </Text>
      </VStack>
    </HStack>
  );
}

function FastingWidgetComponent(props: FastingState, env: WidgetEnvironment) {
  'widget';

  const palette = env.colorScheme === 'dark' ? WIDGET_COLORS.dark : WIDGET_COLORS.light;

  return env.widgetFamily === 'systemSmall' ? (
    <SmallWidget state={props} palette={palette} />
  ) : (
    <MediumWidget state={props} palette={palette} />
  );
}

const FastingWidget = createWidget<FastingState>('FastingWidget', FastingWidgetComponent);
export default FastingWidget;
