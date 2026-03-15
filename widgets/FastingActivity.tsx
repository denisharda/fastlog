/**
 * Live Activity / Dynamic Island for FastAI
 *
 * Uses expo-widgets createLiveActivity API.
 * Shows fasting timer and current phase in the Dynamic Island.
 *
 * Layouts:
 * - compactLeading: green timer icon
 * - compactTrailing: elapsed time text
 * - minimal: small green progress indicator
 * - banner (expanded): phase name + timer
 * - expandedLeading: phase icon + name
 * - expandedTrailing: timer + target hours
 * - expandedBottom: current phase description
 *
 * Constraints:
 * - Data must stay under 4KB (ActivityKit limit)
 * - No marketing content (Apple prohibits ads in Live Activities)
 * - iOS 8h auto-dismiss limit — widget continues working
 */

import { createLiveActivity, Text, VStack, HStack, Image } from '@expo/ui/swift-ui';

const COLORS = {
  primary: '#2D6A4F',
  accent: '#40916C',
  textPrimary: '#F5F5F5',
  textMuted: '#9CA3AF',
};

interface FastingActivityState {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}

const FastingActivity = createLiveActivity<FastingActivityState>({
  /**
   * Banner view — shown in notification-style banner
   */
  banner: ({ state }) => (
    <VStack padding={16}>
      <Text color={COLORS.accent} fontSize={13} fontWeight="semibold">
        {state.phase}
      </Text>
      <HStack>
        <Text
          color={COLORS.textPrimary}
          fontSize={24}
          fontWeight="bold"
          fontDesign="monospaced"
          date={state.startedAt}
          dateStyle="timer"
        />
        <Text color={COLORS.textMuted} fontSize={14}>
          {' '}/ {state.targetHours}h
        </Text>
      </HStack>
    </VStack>
  ),

  /**
   * Compact leading — left side of Dynamic Island pill
   */
  compactLeading: () => (
    <Text fontSize={16}>🟢</Text>
  ),

  /**
   * Compact trailing — right side of Dynamic Island pill
   */
  compactTrailing: ({ state }) => (
    <Text
      color={COLORS.textPrimary}
      fontSize={13}
      fontWeight="medium"
      fontDesign="monospaced"
      date={state.startedAt}
      dateStyle="timer"
    />
  ),

  /**
   * Minimal — smallest Dynamic Island representation
   */
  minimal: () => (
    <Text fontSize={12}>🟢</Text>
  ),

  /**
   * Expanded leading — left side when Dynamic Island is expanded
   */
  expandedLeading: ({ state }) => (
    <VStack>
      <Text color={COLORS.accent} fontSize={14} fontWeight="semibold">
        {state.phase}
      </Text>
      <Text color={COLORS.textMuted} fontSize={11}>
        {state.protocol}
      </Text>
    </VStack>
  ),

  /**
   * Expanded trailing — right side when Dynamic Island is expanded
   */
  expandedTrailing: ({ state }) => (
    <VStack alignment="trailing">
      <Text
        color={COLORS.textPrimary}
        fontSize={20}
        fontWeight="bold"
        fontDesign="monospaced"
        date={state.startedAt}
        dateStyle="timer"
      />
      <Text color={COLORS.textMuted} fontSize={11}>
        Goal: {state.targetHours}h
      </Text>
    </VStack>
  ),

  /**
   * Expanded bottom — bottom section when Dynamic Island is fully expanded
   */
  expandedBottom: ({ state }) => (
    <Text color={COLORS.textMuted} fontSize={12} padding={[0, 16, 8, 16]}>
      {state.phaseDescription}
    </Text>
  ),
});

export default FastingActivity;
