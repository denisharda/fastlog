/**
 * Live Activity / Dynamic Island — Ring Echo design.
 *
 * A mini progress ring echoes across every surface:
 *   compactLeading: 22pt mini ring
 *   compactTrailing: timer
 *   minimal: 22pt mini ring
 *   expandedLeading: 72pt ring with timer inside
 *   expandedTrailing: phase + protocol
 *   expandedBottom: phase description · ends HH:mm
 *   banner: icon badge + timer + phase description
 */

import { createLiveActivity } from 'expo-widgets';
import type { LiveActivityLayout, LiveActivityFactory } from 'expo-widgets';
import type { LiveActivityEnvironment } from 'expo-widgets/build/Widgets.types';
import { Text, VStack, HStack, ZStack, Gauge, Circle } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  monospacedDigit,
  frame,
  background,
  gaugeStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';

// Phase colors for the ring tint — Amber Sunrise spectrum.
const PHASE_RING_COLORS = [
  '#E8C89A',
  '#E6A86B',
  '#D88845',
  '#C8621B',
  '#A04418',
  '#6B2A12',
] as const;

const PHASE_THRESHOLDS = [
  { name: 'Fed State', min: 0 },
  { name: 'Early Fasting', min: 4 },
  { name: 'Fat Burning Begins', min: 8 },
  { name: 'Fat Burning Peak', min: 12 },
  { name: 'Autophagy Zone', min: 16 },
  { name: 'Deep Fast', min: 18 },
] as const;

function phaseIdxFromName(name: string): number {
  const i = PHASE_THRESHOLDS.findIndex((p) => p.name === name);
  return i < 0 ? 0 : i;
}

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
  const idx = phaseIdxFromName(props.phase);
  const ringColor = PHASE_RING_COLORS[idx];
  const endAt = new Date(start.getTime() + props.targetHours * 3600000);
  const endLabel = endAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  // Rough progress at this instant — frozen until next update, but the timer
  // text inside the ring still ticks via Text(date: style: .timer).
  const elapsedH = (Date.now() - start.getTime()) / 3600000;
  const progress = props.targetHours > 0
    ? Math.min(Math.max(elapsedH / props.targetHours, 0), 1)
    : 0;

  const miniRing = (
    <Gauge
      value={progress}
      min={0}
      max={1}
      modifiers={[
        gaugeStyle('circularCapacity'),
        tint(ringColor),
        frame({ width: 22, height: 22 }),
      ]}
    />
  );

  const bigRing = (
    <Gauge
      value={progress}
      min={0}
      max={1}
      modifiers={[
        gaugeStyle('circularCapacity'),
        tint(ringColor),
        frame({ width: 72, height: 72 }),
      ]}
      currentValueLabel={
        <VStack>
          <Text
            date={start}
            dateStyle="timer"
            modifiers={[
              foregroundStyle('#F5F5F5'),
              font({ size: 13, weight: 'bold', design: 'monospaced' }),
              monospacedDigit(),
            ]}
          />
          <Text
            modifiers={[
              foregroundStyle('#A8957A'),
              font({ size: 8 }),
            ]}
          >
            of {props.targetHours}h
          </Text>
        </VStack>
      }
    />
  );

  return {
    compactLeading: miniRing,

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

    minimal: miniRing,

    expandedLeading: (
      <VStack modifiers={[padding({ leading: 8, top: 4, bottom: 4 })]}>
        {bigRing}
      </VStack>
    ),

    expandedTrailing: (
      <VStack modifiers={[padding({ trailing: 8, top: 4, bottom: 4 })]}>
        <Text
          modifiers={[
            foregroundStyle('#D89B2B'),
            font({ size: 12, weight: 'bold' }),
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

    expandedBottom: (
      <Text
        modifiers={[
          foregroundStyle('#A8957A'),
          font({ size: 11 }),
          padding({ leading: 16, trailing: 16, bottom: 8 }),
        ]}
      >
        {props.phaseDescription} · ends {endLabel}
      </Text>
    ),

    banner: (
      <HStack modifiers={[padding({ all: 14 })]}>
        <ZStack
          modifiers={[
            frame({ width: 44, height: 44 }),
            background('#C8621B'),
          ]}
        >
          <Circle
            modifiers={[
              foregroundStyle('rgba(255,255,255,0.25)'),
              frame({ width: 26, height: 26 }),
            ]}
          />
          <Gauge
            value={progress}
            min={0}
            max={1}
            modifiers={[
              gaugeStyle('circularCapacity'),
              tint('#FFFFFF'),
              frame({ width: 26, height: 26 }),
            ]}
          />
        </ZStack>
        <VStack modifiers={[padding({ leading: 12 })]}>
          <Text
            modifiers={[
              foregroundStyle('#D89B2B'),
              font({ size: 11, weight: 'bold' }),
            ]}
          >
            {props.phase.toUpperCase()}
          </Text>
          <HStack>
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
                font({ size: 14 }),
              ]}
            >
              {' '}/ {props.targetHours}h
            </Text>
          </HStack>
          <Text
            modifiers={[
              foregroundStyle('#9CA3AF'),
              font({ size: 11 }),
            ]}
          >
            {props.phaseDescription} · ends {endLabel}
          </Text>
        </VStack>
      </HStack>
    ),
  };
}

const FastingActivity: LiveActivityFactory<FastingActivityState> =
  createLiveActivity('FastingActivity', FastingActivityComponent);

export default FastingActivity;
