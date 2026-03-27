import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface FullScreenWaveProps {
  progress: number;
  width: number;
  height: number;
}

export const FullScreenWave = React.memo(function FullScreenWave({
  progress,
  width,
  height,
}: FullScreenWaveProps) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  if (clampedProgress <= 0 || width === 0 || height === 0) return null;

  const fillHeight = clampedProgress * height;
  const baseY = height - fillHeight;

  const [wavePath, setWavePath] = React.useState(() =>
    buildWavePath(0, baseY, width, height)
  );

  useEffect(() => {
    const id = phase.addListener(({ value }) => {
      setWavePath(buildWavePath(value, baseY, width, height));
    });
    return () => phase.removeListener(id);
  }, [phase, baseY, width, height]);

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
});

function buildWavePath(
  phaseOffset: number,
  baseY: number,
  width: number,
  height: number
): string {
  const amplitude = 12;
  const steps = 40;
  const stepWidth = width / steps;
  const shift = phaseOffset * Math.PI * 2;

  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = i * stepWidth;
    const y = baseY + Math.sin((i / steps) * Math.PI * 4 + shift) * amplitude;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  points.push(`L${width},${height}`);
  points.push(`L0,${height}`);
  points.push('Z');
  return points.join(' ');
}
