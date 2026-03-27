# Water Tab UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the water tab from a functional but bland screen into a delightful, motivating hydration tracker with animated wave, animated numbers, phase-aware tips, last-drink timestamp, and goal celebration.

**Architecture:** The screen keeps the same component structure (FullScreenWave, WaterPercentCircle, QuickTapRow, InlineStepper) but each gets refined. The wave becomes animated (oscillating). The circle shows animated count-up numbers and the primary intake amount (not just %). A new hydration tips constant provides phase-aware copy. The hook exposes `lastLoggedAt` for the timestamp. Goal completion triggers confetti + success haptic.

**Tech Stack:** React Native Animated API (or `react-native-reanimated` if already installed), expo-haptics, existing SVG components, existing Zustand store.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/water/FullScreenWave.tsx` | Modify | Add gentle wave oscillation animation |
| `components/water/WaterPercentCircle.tsx` | Modify → rename to `WaterHeroDisplay.tsx` | Show primary intake number (animated count-up), remaining amount, last-drink time |
| `components/water/GoalCelebration.tsx` | Create | Confetti/glow overlay on 100% goal |
| `constants/hydration.ts` | Modify | Add phase-aware hydration tip map |
| `hooks/useHydration.ts` | Modify | Expose `lastLoggedAt` timestamp |
| `app/(tabs)/water.tsx` | Modify | Tighter layout, integrate new components, phase tips |

---

### Task 1: Animated Wave Oscillation

**Files:**
- Modify: `components/water/FullScreenWave.tsx`

The current wave is static (useMemo with fixed sine). We'll add a gentle horizontal phase shift using `Animated` so the wave appears to ripple continuously.

- [ ] **Step 1.1: Add Animated phase offset**

Replace the contents of `components/water/FullScreenWave.tsx` with:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface FullScreenWaveProps {
  progress: number;
  width: number;
  height: number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

  // We use a listener-based approach to rebuild path on each frame
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
```

- [ ] **Step 1.2: Verify wave animates**

Run the app, navigate to the Water tab, log some water so the wave is visible. Confirm the wave gently oscillates horizontally in a continuous loop.

- [ ] **Step 1.3: Commit**

```bash
git add components/water/FullScreenWave.tsx
git commit -m "feat(water): add gentle wave oscillation animation"
```

---

### Task 2: Hero Display — Animated Intake Number + Last Drink

**Files:**
- Modify: `components/water/WaterPercentCircle.tsx` (rewrite in place, keep filename for simplicity)

Replace the percent-only circle with a richer display: large animated intake number, remaining amount text, and last-drink timestamp.

- [ ] **Step 2.1: Rewrite WaterPercentCircle**

Replace the contents of `components/water/WaterPercentCircle.tsx` with:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface WaterPercentCircleProps {
  progressRatio: number;
  remainingMl: number;
  todayTotalMl: number;
  dailyGoalMl: number;
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

export const WaterPercentCircle = React.memo(function WaterPercentCircle({
  progressRatio,
  remainingMl,
  todayTotalMl,
  dailyGoalMl,
  lastLoggedAt,
}: WaterPercentCircleProps) {
  const goalReached = progressRatio >= 1;
  const animatedValue = useRef(new Animated.Value(0)).current;
  const prevTotal = useRef(0);

  useEffect(() => {
    animatedValue.setValue(prevTotal.current);
    Animated.timing(animatedValue, {
      toValue: todayTotalMl,
      duration: 400,
      useNativeDriver: false,
    }).start();
    prevTotal.current = todayTotalMl;
  }, [todayTotalMl, animatedValue]);

  const [displayedTotal, setDisplayedTotal] = React.useState(todayTotalMl);

  useEffect(() => {
    const id = animatedValue.addListener(({ value }) => {
      setDisplayedTotal(Math.round(value));
    });
    return () => animatedValue.removeListener(id);
  }, [animatedValue]);

  return (
    <View
      className="w-52 h-52 rounded-full bg-white items-center justify-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      }}
    >
      {goalReached ? (
        <>
          <Text className="text-primary text-4xl font-bold">✓</Text>
          <Text className="text-primary text-base font-semibold mt-1">
            Goal reached!
          </Text>
          <Text className="text-text-muted text-xs mt-1">
            {todayTotalMl}ml today
          </Text>
        </>
      ) : (
        <>
          <Text
            className="text-text-primary text-[44px] font-bold"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {displayedTotal}
          </Text>
          <Text className="text-text-muted text-sm -mt-1">
            of {dailyGoalMl}ml
          </Text>
          <Text className="text-primary text-xs font-semibold mt-2">
            {remainingMl}ml to go
          </Text>
        </>
      )}
      {lastLoggedAt && (
        <Text className="text-text-muted/60 text-[10px] mt-1">
          Last drink: {formatTimeSince(lastLoggedAt)}
        </Text>
      )}
    </View>
  );
});
```

- [ ] **Step 2.2: Commit**

```bash
git add components/water/WaterPercentCircle.tsx
git commit -m "feat(water): animated intake number, remaining amount, last drink time"
```

---

### Task 3: Expose lastLoggedAt from Hook

**Files:**
- Modify: `hooks/useHydration.ts`

- [ ] **Step 3.1: Add lastLoggedAt to the hook return**

In `hooks/useHydration.ts`, add the computed value and update the interface:

Add to `UseHydrationReturn` interface:
```ts
  lastLoggedAt: string | null;
```

Add the computed value after the `progressRatio` useMemo:
```ts
  const lastLoggedAt = useMemo(
    () => (todayLogs.length > 0 ? todayLogs[todayLogs.length - 1].logged_at : null),
    [todayLogs]
  );
```

Add `lastLoggedAt` to the return object.

- [ ] **Step 3.2: Commit**

```bash
git add hooks/useHydration.ts
git commit -m "feat(water): expose lastLoggedAt from useHydration hook"
```

---

### Task 4: Phase-Aware Hydration Tips

**Files:**
- Modify: `constants/hydration.ts`

- [ ] **Step 4.1: Add hydration tips map**

Append to `constants/hydration.ts`:

```ts
/**
 * Phase-aware hydration tips shown on the water screen during a fast.
 * Keys match phase names from constants/phases.ts.
 */
export const PHASE_HYDRATION_TIPS: Record<string, string> = {
  'Fed State': 'Water aids digestion — keep sipping',
  'Early Fasting': 'Hunger? Try a glass of water first',
  'Fat Burning Begins': 'Electrolytes help — add a pinch of salt',
  'Fat Burning Peak': 'Ketosis increases water loss — drink up',
  'Autophagy Zone': 'Water helps flush cellular waste',
  'Deep Fast': 'Stay hydrated — your body is in deep repair',
};
```

- [ ] **Step 4.2: Commit**

```bash
git add constants/hydration.ts
git commit -m "feat(water): add phase-aware hydration tips"
```

---

### Task 5: Goal Celebration Component

**Files:**
- Create: `components/water/GoalCelebration.tsx`

A simple overlay that appears briefly when the user first hits 100%. Uses scaling animation + success haptic.

- [ ] **Step 5.1: Create GoalCelebration component**

Create `components/water/GoalCelebration.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface GoalCelebrationProps {
  visible: boolean;
}

export function GoalCelebration({ visible }: GoalCelebrationProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (visible && !hasTriggered.current) {
      hasTriggered.current = true;

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            tension: 50,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1500),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (!visible) {
      hasTriggered.current = false;
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
        },
      ]}
    >
      <Animated.Text
        style={{
          fontSize: 80,
          transform: [{ scale }],
        }}
      >
        💧
      </Animated.Text>
    </Animated.View>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git add components/water/GoalCelebration.tsx
git commit -m "feat(water): add goal celebration overlay with haptic"
```

---

### Task 6: Integrate Everything into Water Screen

**Files:**
- Modify: `app/(tabs)/water.tsx`

Wire up the new props, phase tips, celebration, and tighten the layout.

- [ ] **Step 6.1: Rewrite water screen**

Replace the contents of `app/(tabs)/water.tsx` with:

```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, LayoutAnimation, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';
import { useHydration } from '../../hooks/useHydration';
import { useFasting } from '../../hooks/useFasting';
import { FullScreenWave } from '../../components/water/FullScreenWave';
import { WaterPercentCircle } from '../../components/water/WaterPercentCircle';
import { QuickTapRow } from '../../components/water/QuickTapRow';
import { InlineStepper } from '../../components/water/InlineStepper';
import { GoalCelebration } from '../../components/water/GoalCelebration';
import { PHASE_HYDRATION_TIPS } from '../../constants/hydration';

export default function WaterScreen() {
  const { width, height } = useWindowDimensions();
  const [stepperVisible, setStepperVisible] = useState(false);

  const {
    todayTotalMl,
    dailyGoalMl,
    progressRatio,
    logWater,
    undoLastLog,
    lastLoggedAt,
    snackbar,
    dismissSnackbar,
  } = useHydration();

  const { isActive, currentPhase, elapsedHours } = useFasting();

  const remainingMl = Math.max(dailyGoalMl - todayTotalMl, 0);

  // Track goal celebration — only show once per session
  const [showCelebration, setShowCelebration] = useState(false);
  const prevRatio = useRef(progressRatio);
  useEffect(() => {
    if (prevRatio.current < 1 && progressRatio >= 1) {
      setShowCelebration(true);
    }
    prevRatio.current = progressRatio;
  }, [progressRatio]);

  const handleToggleMore = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible((prev) => !prev);
  }, []);

  const handleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible(false);
  }, []);

  const phaseTip = isActive
    ? PHASE_HYDRATION_TIPS[currentPhase.name] ?? null
    : null;

  return (
    <SafeAreaView edges={{ bottom: true }} style={{ flex: 1 }} className="bg-background">
      <FullScreenWave progress={progressRatio} width={width} height={height} />

      <View className="flex-1 justify-between pt-6 px-6 pb-2">
        {/* Header */}
        <View>
          <Text className="text-text-primary text-2xl font-bold">Hydration</Text>
          {phaseTip && (
            <Text className="text-primary/80 text-xs font-medium mt-1">
              {phaseTip}
            </Text>
          )}
        </View>

        {/* Center circle */}
        <View className="items-center">
          <WaterPercentCircle
            progressRatio={progressRatio}
            remainingMl={remainingMl}
            todayTotalMl={todayTotalMl}
            dailyGoalMl={dailyGoalMl}
            lastLoggedAt={lastLoggedAt}
          />
        </View>

        {/* Bottom section */}
        <View>
          {/* Status text / inline undo feedback */}
          <View className="h-6 mb-3 justify-center">
            {snackbar.visible ? (
              <View className="flex-row items-center justify-center">
                <Text className="text-accent text-sm font-medium">
                  {snackbar.message}
                </Text>
                {snackbar.lastLog && (
                  <Pressable
                    onPress={() => {
                      undoLastLog();
                      dismissSnackbar();
                    }}
                    className="ml-2 px-2 py-0.5 rounded-md bg-white/10"
                    accessibilityLabel="Undo last water log"
                    accessibilityRole="button"
                  >
                    <Text className="text-text-muted text-xs font-semibold">Undo</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text className="text-text-muted text-center text-sm">
                {Math.round(progressRatio * 100)}% of daily goal
              </Text>
            )}
          </View>

          {/* Quick-tap row */}
          <QuickTapRow
            onQuickAdd={logWater}
            onToggleMore={handleToggleMore}
            moreExpanded={stepperVisible}
          />

          {/* Custom amount input */}
          <InlineStepper
            visible={stepperVisible}
            onAdd={logWater}
            onCollapse={handleCollapse}
          />
        </View>
      </View>

      <GoalCelebration visible={showCelebration} />
    </SafeAreaView>
  );
}
```

- [ ] **Step 6.2: Verify full integration**

Run the app, navigate to Water tab. Verify:
1. Wave gently oscillates
2. Circle shows animated intake number (count up when logging)
3. "Xml to go" motivational text visible
4. Last drink timestamp appears after logging
5. Phase tip shows when fasting is active
6. Hitting 100% triggers 💧 celebration + haptic
7. Quick-tap row and stepper still work
8. Undo still works
9. Layout is tight — no excessive empty space

- [ ] **Step 6.3: Commit**

```bash
git add app/(tabs)/water.tsx components/water/GoalCelebration.tsx
git commit -m "feat(water): integrate hero display, phase tips, goal celebration"
```

---

### Task 7: Final Polish — Layout & Spacing

**Files:**
- Modify: `app/(tabs)/water.tsx` (if needed after visual check)

- [ ] **Step 7.1: Visual check and spacing adjustments**

After running the full integration, check on a real device or simulator:
- Is there excessive space between header and circle? Reduce `pt-6` or use `pt-4`.
- Is the circle too large or small? Adjust `w-52 h-52` in WaterPercentCircle if needed.
- Are the quick-tap buttons too close to the bottom? Adjust `pb-2` to `pb-4` if needed.

Make adjustments directly based on what you see. No code shown here since this is visual tuning.

- [ ] **Step 7.2: Final commit**

```bash
git add -A
git commit -m "style(water): polish spacing and layout"
```

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| Wave | Static sine | Gentle oscillating animation |
| Hero circle | % only, static | Animated ml count-up, remaining, last drink time |
| Phase context | Generic "stay hydrated" | Phase-specific hydration tip |
| Goal completion | Checkmark | 💧 animation + success haptic |
| Layout | Spread with empty space | Compact: header top, circle center, buttons bottom |
| Status text | "1250 / 2000 ml" | "63% of daily goal" (snackbar shows details) |
