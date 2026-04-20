/**
 * Home Screen Widget for FastLog — Timer Forward design.
 *
 * Renders phase eyebrow, big timer, and a progress line. Uses only
 * Text / VStack / HStack / Spacer because the widget extension target
 * doesn't link the native ExpoUI module that backs Gauge / Circle /
 * Rectangle. Adapts to system appearance (light/dark).
 *
 * Colour palette is mirrored from constants/theme.ts — keep in sync.
 */

import { createWidget, WidgetEnvironment } from 'expo-widgets';
import { Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  widgetURL,
  background,
} from '@expo/ui/swift-ui/modifiers';

interface WidgetPalette {
  bg: string;
  surface2: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  accent: string;
  phases: readonly [string, string, string, string, string, string];
}

const WIDGET_COLORS: { light: WidgetPalette; dark: WidgetPalette } = {
  light: {
    bg: '#FBF6EE',
    surface2: '#F5EEE2',
    text: '#2A1F14',
    textMuted: '#6B5A44',
    textFaint: '#A8957A',
    primary: '#C8621B',
    accent: '#D89B2B',
    phases: ['#E8C89A', '#E6A86B', '#D88845', '#C8621B', '#A04418', '#6B2A12'],
  },
  dark: {
    bg: '#17110A',
    surface2: '#2B2115',
    text: '#FBF3E3',
    textMuted: '#C9B590',
    textFaint: '#7A6B54',
    primary: '#E89B5C',
    accent: '#EDBC52',
    phases: ['#6B5232', '#9C7341', '#C8894A', '#E89B5C', '#F0B878', '#F8D9A8'],
  },
};

const PHASE_THRESHOLDS = [
  { name: 'Fed State', min: 0 },
  { name: 'Early Fasting', min: 4 },
  { name: 'Fat Burning Begins', min: 8 },
  { name: 'Fat Burning Peak', min: 12 },
  { name: 'Autophagy Zone', min: 16 },
  { name: 'Deep Fast', min: 18 },
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
  const phaseColor = palette.phases[idx];
  const progress = state.targetHours > 0
    ? Math.min(Math.max(elapsed / state.targetHours, 0), 1)
    : 0;
  const percent = Math.round(progress * 100);
  const phase = phaseName(idx);

  return (
    <VStack
      modifiers={[
        background(palette.bg),
        padding({ all: 14 }),
        widgetURL('fastlog://timer'),
      ]}
    >
      <Text
        modifiers={[
          foregroundStyle(phaseColor),
          font({ size: 10, weight: 'bold' }),
        ]}
      >
        {phase.toUpperCase()}
      </Text>
      <Spacer />
      <Text
        date={new Date(state.startedAt)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle(palette.text),
          font({ size: 26, weight: 'bold', design: 'monospaced' }),
        ]}
      />
      <Text
        modifiers={[
          foregroundStyle(palette.textMuted),
          font({ size: 11 }),
        ]}
      >
        of {state.targetHours}h
      </Text>
      <Spacer />
      <Text
        modifiers={[
          foregroundStyle(palette.textFaint),
          font({ size: 11 }),
        ]}
      >
        {percent}% · {state.protocol}
      </Text>
    </VStack>
  );
}

function SmallInactive({ state, palette }: { state: FastingState; palette: WidgetPalette }) {
  const targetHours = state.targetHours > 0 ? state.targetHours : 16;
  const protocolLabel = state.protocol || '16:8';

  return (
    <VStack
      modifiers={[
        background(palette.bg),
        padding({ all: 14 }),
        widgetURL('fastlog://start'),
      ]}
    >
      <Text
        modifiers={[
          foregroundStyle(palette.accent),
          font({ size: 10, weight: 'bold' }),
        ]}
      >
        FASTLOG
      </Text>
      <Spacer />
      <Text
        modifiers={[
          foregroundStyle(palette.primary),
          font({ size: 34, weight: 'bold' }),
        ]}
      >
        {targetHours}h
      </Text>
      <Text
        modifiers={[
          foregroundStyle(palette.textMuted),
          font({ size: 12 }),
        ]}
      >
        {protocolLabel} protocol
      </Text>
      <Spacer />
      <Text
        modifiers={[
          foregroundStyle(palette.accent),
          font({ size: 12, weight: 'semibold' }),
        ]}
      >
        Tap to start
      </Text>
    </VStack>
  );
}

function MediumWidget({ state, palette }: { state: FastingState; palette: WidgetPalette }) {
  if (!state.isActive || !state.startedAt) {
    return <MediumInactive state={state} palette={palette} />;
  }

  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 3600000;
  const idx = phaseIndex(elapsed);
  const phaseColor = palette.phases[idx];
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
        background(palette.bg),
        padding({ all: 16 }),
        widgetURL('fastlog://timer'),
      ]}
    >
      <VStack>
        <Text
          modifiers={[
            foregroundStyle(phaseColor),
            font({ size: 10, weight: 'bold' }),
          ]}
        >
          {phase.toUpperCase()}
        </Text>
        <Spacer />
        <Text
          date={new Date(state.startedAt)}
          dateStyle="timer"
          modifiers={[
            foregroundStyle(palette.text),
            font({ size: 34, weight: 'bold', design: 'monospaced' }),
          ]}
        />
        <Text
          modifiers={[
            foregroundStyle(palette.textMuted),
            font({ size: 12 }),
          ]}
        >
          {percent}% of {state.targetHours}h · {state.protocol}
        </Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing">
        <Text
          modifiers={[
            foregroundStyle(palette.textFaint),
            font({ size: 10, weight: 'semibold' }),
          ]}
        >
          ENDS AT
        </Text>
        <Text
          modifiers={[
            foregroundStyle(palette.text),
            font({ size: 18, weight: 'bold' }),
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
        background(palette.bg),
        padding({ all: 16 }),
        widgetURL('fastlog://start'),
      ]}
    >
      <VStack>
        <Text
          modifiers={[
            foregroundStyle(palette.accent),
            font({ size: 10, weight: 'bold' }),
          ]}
        >
          FASTLOG
        </Text>
        <Spacer />
        <Text
          modifiers={[
            foregroundStyle(palette.text),
            font({ size: 20, weight: 'semibold' }),
          ]}
        >
          Ready when you are
        </Text>
        <Text
          modifiers={[
            foregroundStyle(palette.textMuted),
            font({ size: 12 }),
          ]}
        >
          {protocolLabel} · tap to start
        </Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing">
        <Text
          modifiers={[
            foregroundStyle(palette.primary),
            font({ size: 48, weight: 'bold' }),
          ]}
        >
          {targetHours}h
        </Text>
        <Text
          modifiers={[
            foregroundStyle(palette.textMuted),
            font({ size: 11 }),
          ]}
        >
          duration
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
