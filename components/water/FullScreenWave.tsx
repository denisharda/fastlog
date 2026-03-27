import React, { useMemo } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface FullScreenWaveProps {
  /** 0-1 fill ratio */
  progress: number;
  width: number;
  height: number;
}

/**
 * Single-wave full-screen water fill background.
 * Height directly maps to progress — no decorative shimmer.
 */
export const FullScreenWave = React.memo(function FullScreenWave({ progress, width, height }: FullScreenWaveProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const fillHeight = clampedProgress * height;
  const baseY = height - fillHeight;

  const wavePath = useMemo(() => {
    const amplitude = 12;
    const steps = 20;
    const stepWidth = width / steps;

    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = i * stepWidth;
      const y = baseY + Math.sin((i / steps) * Math.PI * 4) * amplitude;
      points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    points.push(`L${width},${height}`);
    points.push(`L0,${height}`);
    points.push('Z');
    return points.join(' ');
  }, [clampedProgress, width, height, baseY]);

  if (clampedProgress <= 0 || width === 0 || height === 0) return null;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2D6A4F" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#40916C" stopOpacity="0.15" />
        </LinearGradient>
      </Defs>
      <Path d={wavePath} fill="url(#waveGrad)" />
    </Svg>
  );
}, (prev, next) => {
  return (
    Math.abs(prev.progress - next.progress) < 0.005 &&
    prev.width === next.width &&
    prev.height === next.height
  );
});
