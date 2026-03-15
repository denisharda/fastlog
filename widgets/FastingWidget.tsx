/**
 * Home Screen Widget for FastAI
 *
 * Uses @expo/ui/swift-ui components via @bittingz/expo-widgets.
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

import { Widget, Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';

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
        background={COLORS.background}
        padding={16}
        link="fastai://start"
      >
        <Text color={COLORS.textMuted} fontSize={12}>
          No Active Fast
        </Text>
        <Spacer />
        <Text color={COLORS.accent} fontSize={14} fontWeight="semibold">
          Tap to start
        </Text>
      </VStack>
    );
  }

  const elapsed = state.startedAt
    ? (Date.now() - new Date(state.startedAt).getTime()) / 3600000
    : state.elapsedHours;
  const progress = state.targetHours > 0 ? Math.min(elapsed / state.targetHours, 1) : 0;

  return (
    <VStack
      background={COLORS.background}
      padding={16}
      link="fastai://timer"
    >
      <Text color={COLORS.accent} fontSize={12} fontWeight="medium">
        {state.phase}
      </Text>
      <Spacer />
      {/* SwiftUI relative date text provides live countdown without refreshes */}
      <Text
        color={COLORS.textPrimary}
        fontSize={28}
        fontWeight="bold"
        fontDesign="monospaced"
        date={state.startedAt ?? undefined}
        dateStyle="timer"
      />
      <Text color={COLORS.textMuted} fontSize={11}>
        {elapsed.toFixed(1)}h / {state.targetHours}h
      </Text>
    </VStack>
  );
}

function MediumWidget({ state }: { state: FastingState }) {
  if (!state.isActive) {
    return (
      <HStack
        background={COLORS.background}
        padding={16}
        link="fastai://start"
      >
        <VStack>
          <Text color={COLORS.textPrimary} fontSize={16} fontWeight="bold">
            FastAI
          </Text>
          <Text color={COLORS.textMuted} fontSize={13}>
            No active fast
          </Text>
          <Spacer />
          <Text color={COLORS.accent} fontSize={14} fontWeight="semibold">
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
      background={COLORS.background}
      padding={16}
      link="fastai://timer"
    >
      {/* Left: Timer */}
      <VStack>
        <Text
          color={COLORS.textPrimary}
          fontSize={32}
          fontWeight="bold"
          fontDesign="monospaced"
          date={state.startedAt ?? undefined}
          dateStyle="timer"
        />
        <Text color={COLORS.textMuted} fontSize={12}>
          {elapsed.toFixed(1)}h / {state.targetHours}h ({state.protocol})
        </Text>
      </VStack>
      <Spacer />
      {/* Right: Phase */}
      <VStack alignment="trailing">
        <Text color={COLORS.accent} fontSize={14} fontWeight="semibold">
          {state.phase}
        </Text>
        <Text color={COLORS.textMuted} fontSize={11}>
          Goal: {state.targetHours}h
        </Text>
      </VStack>
    </HStack>
  );
}

export default function FastingWidget() {
  return (
    <Widget
      appGroup="group.com.fastai.app"
      sharedKey="fastingState"
      supportedFamilies={['small', 'medium']}
      refreshPolicy="atEnd"
    >
      {({ state, family }: { state: FastingState; family: string }) =>
        family === 'small' ? (
          <SmallWidget state={state} />
        ) : (
          <MediumWidget state={state} />
        )
      }
    </Widget>
  );
}
