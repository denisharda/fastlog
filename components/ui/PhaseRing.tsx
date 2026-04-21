import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { PHASES, Theme, getPhaseIndex } from '../../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface PhaseRingProps {
  /** Outer diameter in px. */
  size?: number;
  /** Stroke thickness. */
  stroke?: number;
  /** Elapsed hours of the fast (0–24+). */
  hours: number;
  /** Target hours — marker drawn at this position. */
  target?: number;
  theme: Theme;
  showTicks?: boolean;
  animated?: boolean;
}

const TOTAL_HOURS = 24;

/**
 * Six-segment phase ring with progress fill, tick marks, target marker
 * and an animated pulsing head circle at the current position.
 *
 * Ported from design tokens `ui.jsx → PhaseRing`.
 */
export function PhaseRing({
  size = 320,
  stroke = 16,
  hours,
  target = 16,
  theme,
  showTicks = true,
  animated = true,
}: PhaseRingProps) {
  // Shrink ring by HEAD_PAD so the animated head circle (r = stroke/2 + 3)
  // isn't clipped at the top of the viewBox.
  const HEAD_PAD = 4;
  const r = (size - stroke) / 2 - HEAD_PAD;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const targetAnim = useRef(new Animated.Value(target)).current;
  const [animatedTarget, setAnimatedTarget] = useState(target);

  useEffect(() => {
    const id = targetAnim.addListener(({ value }) => setAnimatedTarget(value));
    Animated.timing(targetAnim, {
      toValue: target,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => targetAnim.removeListener(id);
  }, [target, targetAnim]);

  useEffect(() => {
    if (!animated || hours <= 0 || hours >= TOTAL_HOURS) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, hours, pulseAnim]);

  const seg = (startH: number, endH: number) => {
    const s = (startH / TOTAL_HOURS) * circ;
    const e = (endH / TOTAL_HOURS) * circ;
    return { start: s, len: e - s };
  };
  const BG_GAP = 4;
  const FG_GAP = 2;

  // Head position
  const headAngle = (hours / TOTAL_HOURS) * 360 - 90;
  const headX = cx + r * Math.cos((headAngle * Math.PI) / 180);
  const headY = cy + r * Math.sin((headAngle * Math.PI) / 180);

  const activePhaseIdx = getPhaseIndex(Math.min(hours, TOTAL_HOURS - 0.01));

  const innerR = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [stroke / 2 - 2, stroke / 2],
  });

  // Target marker position — uses animated hour value so it tweens between goals
  const targetAngle = (animatedTarget / TOTAL_HOURS) * 360 - 90;
  const targetR = r - stroke / 2 - 10;
  const targetX = cx + targetR * Math.cos((targetAngle * Math.PI) / 180);
  const targetY = cy + targetR * Math.sin((targetAngle * Math.PI) / 180);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation={-90} originX={cx} originY={cy}>
          {/* Faint background arcs per phase */}
          {PHASES.map((p, i) => {
            const { start, len } = seg(p.start, p.end);
            const color = theme.phases[i];
            return (
              <Circle
                key={`bg-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={color}
                strokeOpacity={theme.isDark ? 0.22 : 0.28}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(len - BG_GAP, 0)} ${circ}`}
                strokeDashoffset={-start - BG_GAP / 2}
                strokeLinecap="butt"
              />
            );
          })}

          {/* Vivid progress arcs up to elapsed hours */}
          {PHASES.map((p, i) => {
            const segEnd = Math.min(p.end, hours);
            if (segEnd <= p.start) return null;
            const { start, len } = seg(p.start, segEnd);
            const color = theme.phases[i];
            return (
              <Circle
                key={`fg-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(len - FG_GAP, 0)} ${circ}`}
                strokeDashoffset={-start - FG_GAP / 2}
                strokeLinecap="butt"
              />
            );
          })}
        </G>

        {/* Tick marks — drawn in normal frame (not rotated) */}
        {showTicks &&
          Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * 360 - 90;
            const inner = r + stroke / 2 + 6;
            const outer = inner + (i % 4 === 0 ? 8 : 4);
            const rad = (a * Math.PI) / 180;
            const x1 = cx + inner * Math.cos(rad);
            const y1 = cy + inner * Math.sin(rad);
            const x2 = cx + outer * Math.cos(rad);
            const y2 = cy + outer * Math.sin(rad);
            return (
              <Line
                key={`t-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={theme.textFaint}
                strokeOpacity={i % 4 === 0 ? 0.5 : 0.25}
                strokeWidth={i % 4 === 0 ? 1.5 : 1}
                strokeLinecap="round"
              />
            );
          })}

        {/* Target marker — animates along the ring to the selected goal */}
        {target > 0 && (
          <Circle cx={targetX} cy={targetY} r={3} fill={theme.text} />
        )}

        {/* Animated head (current position) */}
        {hours > 0 && hours < TOTAL_HOURS && (
          <>
            <Circle cx={headX} cy={headY} r={stroke / 2 + 3} fill={theme.surface} />
            <AnimatedCircle
              cx={headX}
              cy={headY}
              r={innerR as unknown as number}
              fill={theme.phases[activePhaseIdx]}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
