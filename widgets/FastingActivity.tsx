/**
 * Live Activity / Dynamic Island — Timer Forward design.
 *
 * Uses only Text / VStack / HStack because the widget extension target
 * doesn't link the native ExpoUI module that backs Gauge / Circle /
 * Rectangle.
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
  const endAt = new Date(start.getTime() + props.targetHours * 3600000);
  const endLabel = endAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return {
    compactLeading: (
      <Text
        modifiers={[
          foregroundStyle('#D89B2B'),
          font({ size: 12, weight: 'bold' }),
        ]}
      >
        {props.protocol}
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
          {props.phase.toUpperCase()}
        </Text>
        <Text
          modifiers={[
            foregroundStyle('#9CA3AF'),
            font({ size: 11 }),
          ]}
        >
          {props.protocol} fast
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
          of {props.targetHours}h
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
        {props.phaseDescription} · ends {endLabel}
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
            {props.phase.toUpperCase()}
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
            {' '}/ {props.targetHours}h
          </Text>
        </HStack>
        <Text
          modifiers={[
            foregroundStyle('#A8957A'),
            font({ size: 11 }),
          ]}
        >
          {props.phaseDescription} · ends {endLabel}
        </Text>
      </VStack>
    ),
  };
}

const FastingActivity: LiveActivityFactory<FastingActivityState> =
  createLiveActivity('FastingActivity', FastingActivityComponent);

export default FastingActivity;
