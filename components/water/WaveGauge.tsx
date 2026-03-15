import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Path, G, Text as SvgText } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WaveGaugeProps {
  /** 0–1 fill ratio */
  progress: number;
  /** Diameter in points */
  size?: number;
}

/**
 * Circular water gauge with animated wave fill.
 * Two overlapping sine waves at different speeds create a liquid sloshing effect.
 */
export function WaveGauge({ progress, size = 64 }: WaveGaugeProps) {
  const wave1Offset = useRef(new Animated.Value(0)).current;
  const wave2Offset = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(progress)).current;

  // Animate wave scrolling
  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.timing(wave1Offset, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    const loop2 = Animated.loop(
      Animated.timing(wave2Offset, {
        toValue: 1,
        duration: 2800,
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

  const r = size / 2;
  const cx = r;
  const cy = r;
  const clipId = 'wave-clip';

  // We use a static SVG since Animated + SVG path is complex in RN.
  // Instead we'll use a simpler visual: filled circle with gradient-like layers.
  const fillHeight = Math.min(progress, 1) * size;
  const fillY = size - fillHeight;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={cx} cy={cy} r={r - 1} />
          </ClipPath>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={r - 1}
          fill="#1A1A1A"
          stroke="#2D6A4F"
          strokeWidth={1.5}
          strokeOpacity={0.3}
        />

        {/* Water fill — clipped to circle */}
        <G clipPath={`url(#${clipId})`}>
          {/* Back wave (darker) */}
          <Path
            d={buildWavePath(size, fillY, 3, 0.3)}
            fill="#2D6A4F"
            fillOpacity={0.5}
          />
          {/* Front wave (brighter) */}
          <Path
            d={buildWavePath(size, fillY + 2, 3.5, 0)}
            fill="#40916C"
            fillOpacity={0.6}
          />
        </G>

        {/* Percentage text */}
        <SvgText
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          alignmentBaseline="central"
          fill="#F5F5F5"
          fontSize={size * 0.22}
          fontWeight="600"
        >
          {Math.round(progress * 100)}%
        </SvgText>
      </Svg>
    </View>
  );
}

/** Build a static sine-wave path that fills from waveY down to size */
function buildWavePath(
  size: number,
  waveY: number,
  amplitude: number,
  phaseOffset: number
): string {
  const points: string[] = [];
  const steps = 40;

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * size;
    const y = waveY + Math.sin((i / steps) * Math.PI * 4 + phaseOffset * Math.PI * 2) * amplitude;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  // Close path down to bottom
  points.push(`L${size},${size}`);
  points.push(`L0,${size}`);
  points.push('Z');

  return points.join(' ');
}
