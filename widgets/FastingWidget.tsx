/**
 * Home Screen Widget for FastBuddy
 *
 * Uses the official expo-widgets API with @expo/ui/swift-ui components.
 * Reads fasting state from App Groups shared UserDefaults.
 *
 * Sizes:
 * - Small: progress indicator + timer + phase name
 * - Medium: ring left, phase details right
 *
 * Inactive state: "No Active Fast — Tap to start" with deep link
 *
 * NOTE: This file is compiled by the expo-widgets plugin into native
 * WidgetKit Swift code. The JSX-like API maps to SwiftUI views.
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

// Colors from design system
const COLORS = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  primary: '#2D6A4F',
  accent: '#40916C',
  textPrimary: '#F5F5F5',
  textMuted: '#9CA3AF',
};

interface FastingState {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
  elapsedHours: number;
}

function SmallWidget({ state }: { state: FastingState }) {
  if (!state.isActive) {
    return (
      <VStack
        modifiers={[
          background(COLORS.background),
          padding({ all: 16 }),
          widgetURL('fastbuddy://start'),
        ]}
      >
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 12 }),
          ]}
        >
          No Active Fast
        </Text>
        <Spacer />
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

  const elapsed = state.startedAt
    ? (Date.now() - new Date(state.startedAt).getTime()) / 3600000
    : state.elapsedHours;

  return (
    <VStack
      modifiers={[
        background(COLORS.background),
        padding({ all: 16 }),
        widgetURL('fastbuddy://timer'),
      ]}
    >
      <Text
        modifiers={[
          foregroundStyle(COLORS.accent),
          font({ size: 12, weight: 'medium' }),
        ]}
      >
        {state.phase}
      </Text>
      <Spacer />
      {/* SwiftUI relative date text provides live countdown without refreshes */}
      <Text
        date={new Date(state.startedAt!)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle(COLORS.textPrimary),
          font({ size: 28, weight: 'bold', design: 'monospaced' }),
        ]}
      />
      <Text
        modifiers={[
          foregroundStyle(COLORS.textMuted),
          font({ size: 11 }),
        ]}
      >
        {elapsed.toFixed(1)}h / {state.targetHours}h
      </Text>
    </VStack>
  );
}

function MediumWidget({ state }: { state: FastingState }) {
  if (!state.isActive) {
    return (
      <HStack
        modifiers={[
          background(COLORS.background),
          padding({ all: 16 }),
          widgetURL('fastbuddy://start'),
        ]}
      >
        <VStack>
          <Text
            modifiers={[
              foregroundStyle(COLORS.textPrimary),
              font({ size: 16, weight: 'bold' }),
            ]}
          >
            FastBuddy
          </Text>
          <Text
            modifiers={[
              foregroundStyle(COLORS.textMuted),
              font({ size: 13 }),
            ]}
          >
            No active fast
          </Text>
          <Spacer />
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
      </HStack>
    );
  }

  const elapsed = state.startedAt
    ? (Date.now() - new Date(state.startedAt).getTime()) / 3600000
    : state.elapsedHours;

  return (
    <HStack
      modifiers={[
        background(COLORS.background),
        padding({ all: 16 }),
        widgetURL('fastbuddy://timer'),
      ]}
    >
      {/* Left: Timer */}
      <VStack>
        <Text
          date={new Date(state.startedAt!)}
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
          {elapsed.toFixed(1)}h / {state.targetHours}h ({state.protocol})
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
          {state.phase}
        </Text>
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 11 }),
          ]}
        >
          Goal: {state.targetHours}h
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
