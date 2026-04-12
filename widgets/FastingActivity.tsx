/**
 * Live Activity / Dynamic Island for FastLog
 *
 * Uses expo-widgets createLiveActivity API with @expo/ui modifiers-based API.
 * Shows fasting timer and current phase in the Dynamic Island.
 *
 * Layouts:
 * - compactLeading: protocol label
 * - compactTrailing: elapsed time
 * - minimal: abbreviated timer
 * - banner: phase name + timer + target + description
 * - expandedLeading: phase name + protocol
 * - expandedTrailing: timer + target
 * - expandedBottom: phase description
 */

import { createLiveActivity } from 'expo-widgets';
import type { LiveActivityLayout } from 'expo-widgets';
import type { LiveActivityEnvironment } from 'expo-widgets/build/Widgets.types';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
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
     * Banner view — shown in notification-style banner on lock screen
     */
    banner: (
      <VStack modifiers={[padding({ all: 16 })]}>
        <HStack>
          <Text
            modifiers={[
              foregroundStyle('#40916C'),
              font({ size: 13, weight: 'semibold' }),
            ]}
          >
            {props.phase}
          </Text>
        </HStack>
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
        <Text
          modifiers={[
            foregroundStyle('#6B7280'),
            font({ size: 11 }),
          ]}
        >
          {props.phaseDescription}
        </Text>
      </VStack>
    ),

    /**
     * Compact leading — left side of Dynamic Island pill
     * Show protocol label for context
     */
    compactLeading: (
      <Text
        modifiers={[
          foregroundStyle('#40916C'),
          font({ size: 12, weight: 'semibold' }),
        ]}
      >
        {props.protocol}
      </Text>
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
     * Show abbreviated timer instead of emoji
     */
    minimal: (
      <Text
        date={new Date(props.startedAt)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle('#F5F5F5'),
          font({ size: 10, weight: 'medium' }),
          monospacedDigit(),
        ]}
      />
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
          {props.protocol} fast
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
          of {props.targetHours}h
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
