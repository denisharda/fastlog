import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface FastingRingProps {
  /** Progress from 0 to 1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

const TRACK_COLOR = '#1A1A1A';
const PROGRESS_COLOR = '#2D6A4F';
const COMPLETED_COLOR = '#40916C';

/**
 * Circular SVG progress ring — the hero element of the timer screen.
 * Children are rendered centered inside the ring.
 */
export const FastingRing = React.memo(function FastingRing({
  progress,
  size = 280,
  strokeWidth = 16,
  children,
}: FastingRingProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const isCompleted = clampedProgress >= 1;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TRACK_COLOR}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isCompleted ? COMPLETED_COLOR : PROGRESS_COLOR}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>

      {/* Center content */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}, (prev, next) => {
  return (
    Math.abs(prev.progress - next.progress) < 0.001 &&
    prev.size === next.size &&
    prev.strokeWidth === next.strokeWidth &&
    prev.children === next.children
  );
});
