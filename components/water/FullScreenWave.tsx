import React, { useMemo, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface FullScreenWaveProps {
  /** 0-1 fill ratio */
  progress: number;
  width: number;
  height: number;
}

/**
 * Full-screen animated water fill background with two overlapping sine waves.
 * Positioned as an absolute overlay with pointerEvents="none".
 *
 * Performance: SVG paths are only rebuilt when progress/dimensions change.
 * Wave shimmer is driven by a native-driver opacity animation on an Animated.View
 * wrapper (no setInterval, no private _value access).
 */
export const FullScreenWave = React.memo(function FullScreenWave({ progress, width, height }: FullScreenWaveProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const fillHeight = clampedProgress * height;
  const baseY = height - fillHeight;

  // Build wave paths only when progress or dimensions change
  const { wave1Path, wave2Path } = useMemo(() => {
    const amplitude = 15;
    const steps = 20;
    const stepWidth = width / steps;

    function buildPath(phaseOffset: number): string {
      const points: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const x = i * stepWidth;
        const y = baseY + Math.sin((i / steps) * Math.PI * 4 + phaseOffset) * amplitude;
        points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      points.push(`L${width},${height}`);
      points.push(`L0,${height}`);
      points.push('Z');
      return points.join(' ');
    }

    return {
      wave1Path: buildPath(0),
      wave2Path: buildPath(1.5),
    };
  }, [clampedProgress, width, height, baseY]);

  // Simple opacity-based animation for wave shimmer effect (uses native driver on View)
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const wave2Opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.5],
  });

  if (clampedProgress <= 0 || width === 0 || height === 0) return null;

  const absoluteFill = { position: 'absolute' as const, top: 0, left: 0 };

  return (
    <>
      {/* Front wave — static opacity */}
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="waveGrad1" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0EA5E9" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#38BDF8" stopOpacity="0.15" />
          </LinearGradient>
        </Defs>
        <Path d={wave1Path} fill="url(#waveGrad1)" opacity={0.5} />
      </Svg>

      {/* Back wave — animated opacity via Animated.View (supports useNativeDriver) */}
      <Animated.View style={[absoluteFill, { opacity: wave2Opacity }]} pointerEvents="none">
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          <Defs>
            <LinearGradient id="waveGrad2" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0EA5E9" stopOpacity="0.2" />
              <Stop offset="1" stopColor="#38BDF8" stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          <Path d={wave2Path} fill="url(#waveGrad2)" />
        </Svg>
      </Animated.View>
    </>
  );
}, (prev, next) => {
  return (
    Math.abs(prev.progress - next.progress) < 0.005 &&
    prev.width === next.width &&
    prev.height === next.height
  );
});
