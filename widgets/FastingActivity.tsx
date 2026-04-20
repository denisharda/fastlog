/**
 * Live Activity / Dynamic Island for FastLog.
 *
 * IMPORTANT: The function below carries the 'widget' directive, which
 * causes babel-preset-expo's widgetsPlugin to serialize the function
 * into a string at build time. That string is stored in App Groups
 * and evaluated later inside the widget extension's JS runtime. Only
 * React, @expo/ui/swift-ui primitives, and the function's own
 * parameters are available — top-level helpers, constants, and
 * imports from other files are NOT. Keep every identifier referenced
 * below defined inside the function body.
 */

import { createLiveActivity } from 'expo-widgets';
import type { LiveActivityLayout, LiveActivityFactory } from 'expo-widgets';
import type { LiveActivityEnvironment } from 'expo-widgets/build/Widgets.types';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';

export interface FastingActivityState {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}

function FastingActivityComponent(
  props: FastingActivityState,
  env: LiveActivityEnvironment
): LiveActivityLayout {
  'widget';

  const start = new Date(props.startedAt);
  const targetHours = props.targetHours > 0 ? props.targetHours : 16;
  const protocolLabel = props.protocol || '16:8';
  const phaseLabel = (props.phase || 'Fed State').toUpperCase();
  const description = props.phaseDescription || '';

  const endAt = new Date(start.getTime() + targetHours * 3600000);
  const endH = endAt.getHours();
  const endM = endAt.getMinutes();
  const hh = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
  const suffix = endH >= 12 ? 'PM' : 'AM';
  const endLabel = `${hh}:${endM < 10 ? '0' : ''}${endM} ${suffix}`;

  return {
    compactLeading: (
      <Text
        modifiers={[
          foregroundStyle('#D89B2B'),
          font({ size: 12, weight: 'bold' }),
        ]}
      >
        {protocolLabel}
      </Text>
    ),

    compactTrailing: (
      <Text
        date={start}
        dateStyle="timer"
        modifiers={[
          foregroundStyle('#F5F5F5'),
          font({ size: 13, weight: 'semibold' }),
          monospacedDigit(),
        ]}
      />
    ),

    minimal: (
      <Text
        date={start}
        dateStyle="timer"
        modifiers={[
          foregroundStyle('#D89B2B'),
          font({ size: 10, weight: 'semibold' }),
          monospacedDigit(),
        ]}
      />
    ),

    expandedLeading: (
      <VStack modifiers={[padding({ leading: 8, top: 4, bottom: 4 })]}>
        <Text
          modifiers={[
            foregroundStyle('#D89B2B'),
            font({ size: 13, weight: 'bold' }),
          ]}
        >
          {phaseLabel}
        </Text>
        <Text
          modifiers={[
            foregroundStyle('#9CA3AF'),
            font({ size: 11 }),
          ]}
        >
          {protocolLabel} fast
        </Text>
      </VStack>
    ),

    expandedTrailing: (
      <VStack
        alignment="trailing"
        modifiers={[padding({ trailing: 8, top: 4, bottom: 4 })]}
      >
        <Text
          date={start}
          dateStyle="timer"
          modifiers={[
            foregroundStyle('#F5F5F5'),
            font({ size: 22, weight: 'bold' }),
            monospacedDigit(),
          ]}
        />
        <Text
          modifiers={[
            foregroundStyle('#9CA3AF'),
            font({ size: 11 }),
          ]}
        >
          of {targetHours}h
        </Text>
      </VStack>
    ),

    expandedBottom: (
      <Text
        modifiers={[
          foregroundStyle('#A8957A'),
          font({ size: 12 }),
          padding({ leading: 16, trailing: 16, bottom: 8 }),
        ]}
      >
        {description} · ends {endLabel}
      </Text>
    ),

    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <HStack>
          <Text
            modifiers={[
              foregroundStyle('#D89B2B'),
              font({ size: 12, weight: 'bold' }),
            ]}
          >
            {phaseLabel}
          </Text>
        </HStack>
        <HStack>
          <Text
            date={start}
            dateStyle="timer"
            modifiers={[
              foregroundStyle('#F5F5F5'),
              font({ size: 26, weight: 'bold' }),
              monospacedDigit(),
            ]}
          />
          <Text
            modifiers={[
              foregroundStyle('#9CA3AF'),
              font({ size: 15 }),
            ]}
          >
            {' '}/ {targetHours}h
          </Text>
        </HStack>
        <Text
          modifiers={[
            foregroundStyle('#A8957A'),
            font({ size: 11 }),
          ]}
        >
          {description} · ends {endLabel}
        </Text>
      </VStack>
    ),
  };
}

const FastingActivity: LiveActivityFactory<FastingActivityState> =
  createLiveActivity('FastingActivity', FastingActivityComponent);

export default FastingActivity;
