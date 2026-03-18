import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface FullScreenWaveProps {
  /** 0–1 fill ratio */
  progress: number;
  width: number;
  height: number;
}

/**
 * Full-screen animated water fill background with two overlapping sine waves.
 * Positioned as an absolute overlay with pointerEvents="none".
 */
export function FullScreenWave({ progress, width, height }: FullScreenWaveProps) {
  const wave1Offset = useRef(new Animated.Value(0)).current;
  const wave2Offset = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(progress)).current;

  const [paths, setPaths] = useState({ front: '', back: '' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wave phase animation loops
  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.timing(wave1Offset, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    const loop2 = Animated.loop(
      Animated.timing(wave2Offset, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, []);

  // Animate fill level with spring
  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: progress,
      damping: 12,
      stiffness: 80,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Rebuild SVG paths at ~30fps
  useEffect(() => {
    if (width === 0 || height === 0) return;

    function tick() {
      const w1 = (wave1Offset as unknown as { _value: number })._value;
      const w2 = (wave2Offset as unknown as { _value: number })._value;
      const f = (fillAnim as unknown as { _value: number })._value;

      const fillHeight = Math.min(f, 1) * height;
      const waveY = height - fillHeight;

      setPaths({
        back: buildWavePath(width, height, waveY, 15, w2),
        front: buildWavePath(width, height, waveY + 4, 15, w1),
      });
    }

    tick();
    intervalRef.current = setInterval(tick, 33);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [width, height]);

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={paths.back} fill="#0369A1" fillOpacity={0.5} />
        <Path d={paths.front} fill="#0EA5E9" fillOpacity={0.4} />
      </Svg>
    </View>
  );
}

/** Build a sine-wave path that fills from waveY down to the bottom */
function buildWavePath(
  width: number,
  height: number,
  waveY: number,
  amplitude: number,
  phaseOffset: number
): string {
  const points: string[] = [];
  const steps = 20;

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y =
      waveY +
      Math.sin((i / steps) * Math.PI * 4 + phaseOffset * Math.PI * 2) *
        amplitude;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  points.push(`L${width},${height}`);
  points.push(`L0,${height}`);
  points.push('Z');

  return points.join(' ');
}
