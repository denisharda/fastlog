import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

interface FastingRingProps {
  /** Progress from 0 to 1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  onPress?: () => void;
}

/**
 * Clock-face style timer ring with radiating tick marks.
 * Children are rendered centered inside the ring.
 */
export const FastingRing = React.memo(function FastingRing({
  progress,
  size = 300,
  strokeWidth = 16,
  children,
  onPress,
}: FastingRingProps) {
  const center = size / 2;
  const radius = (size - strokeWidth * 2) / 2;
  const tickCount = 60;

  const ticks = useMemo(() => {
    const items = [];
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * 360 - 90; // Start from top
      const rad = (angle * Math.PI) / 180;
      const isActive = i / tickCount <= progress;
      const isMajor = i % 5 === 0;

      const innerR = radius - (isMajor ? 14 : 8);
      const outerR = radius;

      items.push({
        key: i,
        x1: center + innerR * Math.cos(rad),
        y1: center + innerR * Math.sin(rad),
        x2: center + outerR * Math.cos(rad),
        y2: center + outerR * Math.sin(rad),
        isActive,
        isMajor,
      });
    }
    return items;
  }, [progress, size, tickCount, center, radius]);

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius + 8}
          fill="white"
          stroke="#E5E7EB"
          strokeWidth={1}
        />
        {/* Tick marks */}
        {ticks.map((tick) => (
          <Line
            key={tick.key}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.isActive ? '#2D6A4F' : '#D1D5DB'}
            strokeWidth={tick.isMajor ? 3 : 1.5}
            strokeLinecap="round"
          />
        ))}
      </Svg>
      {/* Center content */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </Wrapper>
  );
}, (prev, next) => {
  return (
    Math.abs(prev.progress - next.progress) < 0.001 &&
    prev.size === next.size &&
    prev.strokeWidth === next.strokeWidth &&
    prev.children === next.children
  );
});
