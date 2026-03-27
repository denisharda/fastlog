import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Circle, Path, Defs, ClipPath, LinearGradient, Stop } from 'react-native-svg';

const CIRCLE_SIZE = 220;
const WAVE_AMPLITUDE = 8;
const WAVE_STEPS = 40;

interface WaterFillCircleProps {
  progressRatio: number;
  todayTotalMl: number;
  dailyGoalMl: number;
  remainingMl: number;
  lastLoggedAt: string | null;
}

function formatTimeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return 'Yesterday';
}

function buildWavePath(phaseOffset: number, baseY: number, size: number): string {
  const stepWidth = size / WAVE_STEPS;
  const shift = phaseOffset * Math.PI * 2;
  const points: string[] = [];
  for (let i = 0; i <= WAVE_STEPS; i++) {
    const x = i * stepWidth;
    const y = baseY + Math.sin((i / WAVE_STEPS) * Math.PI * 4 + shift) * WAVE_AMPLITUDE;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  points.push(`L${size},${size}`);
  points.push(`L0,${size}`);
  points.push('Z');
  return points.join(' ');
}

export const WaterFillCircle = React.memo(function WaterFillCircle({
  progressRatio,
  todayTotalMl,
  dailyGoalMl,
  remainingMl,
  lastLoggedAt,
}: WaterFillCircleProps) {
  const phase = useRef(new Animated.Value(0)).current;
  const animatedTotal = useRef(new Animated.Value(0)).current;
  const prevTotal = useRef(0);

  // Wave oscillation loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  // Animate intake number
  useEffect(() => {
    animatedTotal.setValue(prevTotal.current);
    Animated.timing(animatedTotal, {
      toValue: todayTotalMl,
      duration: 400,
      useNativeDriver: false,
    }).start();
    prevTotal.current = todayTotalMl;
  }, [todayTotalMl, animatedTotal]);

  const [displayedTotal, setDisplayedTotal] = React.useState(todayTotalMl);
  useEffect(() => {
    const id = animatedTotal.addListener(({ value }) => {
      setDisplayedTotal(Math.round(value));
    });
    return () => animatedTotal.removeListener(id);
  }, [animatedTotal]);

  // Wave path driven by animated phase
  const clamped = Math.min(Math.max(progressRatio, 0), 1);
  const baseY = CIRCLE_SIZE - clamped * CIRCLE_SIZE;
  const [wavePath, setWavePath] = React.useState(() => buildWavePath(0, baseY, CIRCLE_SIZE));

  useEffect(() => {
    const id = phase.addListener(({ value }) => {
      setWavePath(buildWavePath(value, baseY, CIRCLE_SIZE));
    });
    return () => phase.removeListener(id);
  }, [phase, baseY]);

  const goalReached = progressRatio >= 1;
  const radius = CIRCLE_SIZE / 2;

  return (
    <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={CIRCLE_SIZE}
        height={CIRCLE_SIZE}
        viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
        style={{ position: 'absolute' }}
      >
        <Defs>
          <ClipPath id="circleClip">
            <Circle cx={radius} cy={radius} r={radius - 2} />
          </ClipPath>
          <LinearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2D6A4F" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#40916C" stopOpacity="0.2" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={radius}
          cy={radius}
          r={radius - 1}
          fill="white"
          stroke="#E5E7EB"
          strokeWidth={1}
        />
        {clamped > 0 && (
          <Path d={wavePath} fill="url(#waveFill)" clipPath="url(#circleClip)" />
        )}
      </Svg>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {goalReached ? (
          <>
            <Text className="text-primary text-4xl font-bold">✓</Text>
            <Text className="text-primary text-base font-semibold mt-1">Goal reached!</Text>
            <Text className="text-text-muted text-xs mt-1">{todayTotalMl}ml today</Text>
          </>
        ) : (
          <>
            <Text
              className="text-text-primary font-bold"
              style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}
            >
              {displayedTotal.toLocaleString()}
            </Text>
            <Text className="text-text-muted text-sm" style={{ marginTop: -2 }}>
              of {dailyGoalMl.toLocaleString()}ml
            </Text>
            <Text className="text-primary text-xs font-semibold mt-2">
              {remainingMl.toLocaleString()}ml to go
            </Text>
          </>
        )}
        {lastLoggedAt && (
          <Text className="text-text-muted text-[10px] mt-1" style={{ opacity: 0.6 }}>
            Last drink: {formatTimeSince(lastLoggedAt)}
          </Text>
        )}
      </View>
    </View>
  );
});
