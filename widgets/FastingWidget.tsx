/**
 * Home Screen Widget for FastLog.
 *
 * IMPORTANT: The function below carries the 'widget' directive, which
 * causes babel-preset-expo's widgetsPlugin to serialize the function
 * into a string at build time. That string is stored in App Groups
 * and evaluated later inside the widget extension's JS runtime. Only
 * React, @expo/ui/swift-ui primitives, and the function's own
 * parameters are available in that runtime — top-level helpers,
 * constants, and imports from other files are NOT. Keep every
 * identifier referenced below defined inside the function body.
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

export interface FastingState {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
}

function FastingWidgetComponent(props: FastingState, env: WidgetEnvironment) {
  'widget';

  const isDark = env.colorScheme === 'dark';
  const palette = isDark
    ? {
        bg: '#17110A',
        text: '#FBF3E3',
        textMuted: '#C9B590',
        textFaint: '#7A6B54',
        primary: '#E89B5C',
        accent: '#EDBC52',
        phases: ['#6B5232', '#9C7341', '#C8894A', '#E89B5C', '#F0B878', '#F8D9A8'] as const,
      }
    : {
        bg: '#FBF6EE',
        text: '#2A1F14',
        textMuted: '#6B5A44',
        textFaint: '#A8957A',
        primary: '#C8621B',
        accent: '#D89B2B',
        phases: ['#E8C89A', '#E6A86B', '#D88845', '#C8621B', '#A04418', '#6B2A12'] as const,
      };

  const thresholds = [
    { name: 'Fed State', min: 0 },
    { name: 'Early Fasting', min: 4 },
    { name: 'Fat Burning Begins', min: 8 },
    { name: 'Fat Burning Peak', min: 12 },
    { name: 'Autophagy Zone', min: 16 },
    { name: 'Deep Fast', min: 18 },
  ];

  const isActive = Boolean(props?.isActive && props?.startedAt);
  const targetHours = props?.targetHours && props.targetHours > 0 ? props.targetHours : 16;
  const protocolLabel = props?.protocol || '16:8';

  let phaseIdx = 0;
  let elapsedHours = 0;
  let progress = 0;
  let percent = 0;
  let endLabel = '';

  if (isActive && props.startedAt) {
    const startMs = new Date(props.startedAt).getTime();
    elapsedHours = (Date.now() - startMs) / 3600000;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (elapsedHours >= thresholds[i].min) {
        phaseIdx = i;
        break;
      }
    }
    progress = Math.min(Math.max(elapsedHours / targetHours, 0), 1);
    percent = Math.round(progress * 100);
    const endAt = new Date(startMs + targetHours * 3600000);
    const endH = endAt.getHours();
    const endM = endAt.getMinutes();
    const hh = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
    const suffix = endH >= 12 ? 'PM' : 'AM';
    endLabel = `${hh}:${endM < 10 ? '0' : ''}${endM} ${suffix}`;
  }

  const phaseColor = palette.phases[phaseIdx];
  const phaseName = thresholds[phaseIdx].name;

  if (env.widgetFamily === 'systemSmall') {
    if (isActive && props.startedAt) {
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
            {phaseName.toUpperCase()}
          </Text>
          <Spacer />
          <Text
            date={new Date(props.startedAt)}
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
            of {targetHours}h
          </Text>
          <Spacer />
          <Text
            modifiers={[
              foregroundStyle(palette.textFaint),
              font({ size: 11 }),
            ]}
          >
            {percent}% · {protocolLabel}
          </Text>
        </VStack>
      );
    }

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

  if (isActive && props.startedAt) {
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
            {phaseName.toUpperCase()}
          </Text>
          <Spacer />
          <Text
            date={new Date(props.startedAt)}
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
            {percent}% of {targetHours}h · {protocolLabel}
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

const FastingWidget = createWidget<FastingState>('FastingWidget', FastingWidgetComponent);
export default FastingWidget;
