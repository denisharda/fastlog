/**
 * Live Activity / Dynamic Island for FastAI
 *
 * Uses expo-widgets createLiveActivity API with @expo/ui modifiers-based API.
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

import { createLiveActivity } from 'expo-widgets';
import type { LiveActivityLayout } from 'expo-widgets';
// LiveActivityEnvironment is not re-exported from expo-widgets index, import from types
import type { LiveActivityEnvironment } from 'expo-widgets/build/Widgets.types';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  bold,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';

interface FastingActivityState {
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

  return {
    /**
     * Banner view — shown in notification-style banner
     */
    banner: (
      <VStack modifiers={[padding({ all: 16 })]}>
        <Text
          modifiers={[
            foregroundStyle('#40916C'),
            font({ size: 13, weight: 'semibold' }),
          ]}
        >
          {props.phase}
        </Text>
        <HStack>
          <Text
            date={new Date(props.startedAt)}
            dateStyle="timer"
            modifiers={[
              foregroundStyle('#F5F5F5'),
              font({ size: 24, weight: 'bold' }),
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
      </VStack>
    ),

    /**
     * Compact leading — left side of Dynamic Island pill
     */
    compactLeading: (
      <Text modifiers={[font({ size: 16 })]}>🟢</Text>
    ),

    /**
     * Compact trailing — right side of Dynamic Island pill
     */
    compactTrailing: (
      <Text
        date={new Date(props.startedAt)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle('#F5F5F5'),
          font({ size: 13, weight: 'medium' }),
          monospacedDigit(),
        ]}
      />
    ),

    /**
     * Minimal — smallest Dynamic Island representation
     */
    minimal: (
      <Text modifiers={[font({ size: 12 })]}>🟢</Text>
    ),

    /**
     * Expanded leading — left side when Dynamic Island is expanded
     */
    expandedLeading: (
      <VStack>
        <Text
          modifiers={[
            foregroundStyle('#40916C'),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          {props.phase}
        </Text>
        <Text
          modifiers={[
            foregroundStyle('#9CA3AF'),
            font({ size: 11 }),
          ]}
        >
          {props.protocol}
        </Text>
      </VStack>
    ),

    /**
     * Expanded trailing — right side when Dynamic Island is expanded
     */
    expandedTrailing: (
      <VStack alignment="trailing">
        <Text
          date={new Date(props.startedAt)}
          dateStyle="timer"
          modifiers={[
            foregroundStyle('#F5F5F5'),
            font({ size: 20, weight: 'bold' }),
            monospacedDigit(),
          ]}
        />
        <Text
          modifiers={[
            foregroundStyle('#9CA3AF'),
            font({ size: 11 }),
          ]}
        >
          Goal: {props.targetHours}h
        </Text>
      </VStack>
    ),

    /**
     * Expanded bottom — bottom section when Dynamic Island is fully expanded
     */
    expandedBottom: (
      <Text
        modifiers={[
          foregroundStyle('#9CA3AF'),
          font({ size: 12 }),
          padding({ leading: 16, trailing: 16, bottom: 8 }),
        ]}
      >
        {props.phaseDescription}
      </Text>
    ),
  };
}

export default createLiveActivity('FastingActivity', FastingActivityComponent);
