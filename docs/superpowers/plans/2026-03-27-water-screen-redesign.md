# Water Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the water tracking screen with a water-fill circle design featuring an animated wave inside the circle, two pill buttons, and long-press custom input.

**Architecture:** New `WaterFillCircle` component renders an SVG circle with an animated wave path inside (clipped to circle). New `CustomAmountSheet` provides long-press custom input via React Native Modal. The screen (`water.tsx`) is rewritten to use these two components plus inline pill buttons and snackbar. Old components are deleted.

**Tech Stack:** React Native Animated API, react-native-svg (Circle, Path, ClipPath, Defs), expo-haptics, expo-notifications, React Native Modal.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/water/WaterFillCircle.tsx` | Create | Circle with animated wave fill + center content |
| `components/water/CustomAmountSheet.tsx` | Create | Bottom sheet modal for custom ml input |
| `app/(tabs)/water.tsx` | Rewrite | Screen layout: header, circle, pills, snackbar |
| `components/water/FullScreenWave.tsx` | Delete | Replaced by wave inside circle |
| `components/water/WaterPercentCircle.tsx` | Delete | Replaced by WaterFillCircle |
| `components/water/QuickTapRow.tsx` | Delete | Replaced by inline pills |
| `components/water/InlineStepper.tsx` | Delete | Replaced by CustomAmountSheet |
| `components/water/GoalCelebration.tsx` | Delete | Replaced by notification |
| `components/water/UndoSnackbar.tsx` | Delete (if exists) | Replaced by inline snackbar |

---

### Task 1: WaterFillCircle Component

**Files:**
- Create: `components/water/WaterFillCircle.tsx`

- [ ] **Step 1.1: Create WaterFillCircle**

Create `components/water/WaterFillCircle.tsx`:

```tsx
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
      {/* SVG: circle background + clipped wave */}
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
        {/* White circle background */}
        <Circle
          cx={radius}
          cy={radius}
          r={radius - 1}
          fill="white"
          stroke="#E5E7EB"
          strokeWidth={1}
        />
        {/* Animated wave clipped to circle */}
        {clamped > 0 && (
          <Path d={wavePath} fill="url(#waveFill)" clipPath="url(#circleClip)" />
        )}
      </Svg>

      {/* Center content */}
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
```

- [ ] **Step 1.2: Verify it renders**

Import and render `<WaterFillCircle progressRatio={0.5} todayTotalMl={1000} dailyGoalMl={2000} remainingMl={1000} lastLoggedAt={null} />` temporarily in any screen. Confirm:
- White circle with green wave filling ~50%
- Wave gently oscillates
- Number shows "1,000"

- [ ] **Step 1.3: Commit**

```bash
git add components/water/WaterFillCircle.tsx
git commit -m "feat(water): add WaterFillCircle with animated wave fill"
```

---

### Task 2: CustomAmountSheet Component

**Files:**
- Create: `components/water/CustomAmountSheet.tsx`

- [ ] **Step 2.1: Create CustomAmountSheet**

Create `components/water/CustomAmountSheet.tsx`:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { MIN_ADD_AMOUNT_ML, MAX_ADD_AMOUNT_ML } from '../../constants/hydration';

interface CustomAmountSheetProps {
  visible: boolean;
  onAdd: (amountMl: number) => void;
  onClose: () => void;
}

export function CustomAmountSheet({ visible, onAdd, onClose }: CustomAmountSheetProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  const parsed = parseInt(text, 10);
  const isValid = !isNaN(parsed) && parsed >= MIN_ADD_AMOUNT_ML && parsed <= MAX_ADD_AMOUNT_ML;

  function handleAdd() {
    if (!isValid) return;
    onAdd(parsed);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end' }} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl px-6 pt-6 pb-10"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mb-4" />
            <Text className="text-text-primary text-lg font-bold mb-4">Custom Amount</Text>

            <View className="flex-row items-center gap-3">
              <TextInput
                ref={inputRef}
                className="flex-1 h-12 bg-background rounded-xl px-4 text-text-primary text-lg font-bold"
                placeholder={`${MIN_ADD_AMOUNT_ML}–${MAX_ADD_AMOUNT_ML}`}
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={text}
                onChangeText={setText}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
                maxLength={4}
              />
              <Text className="text-text-muted text-sm font-medium">ml</Text>
              <Pressable
                className={`h-12 px-6 rounded-full items-center justify-center ${
                  isValid ? 'bg-primary' : 'bg-gray-200'
                }`}
                onPress={handleAdd}
                disabled={!isValid}
              >
                <Text className={`font-bold text-sm ${isValid ? 'text-white' : 'text-gray-400'}`}>
                  Add
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2.2: Commit**

```bash
git add components/water/CustomAmountSheet.tsx
git commit -m "feat(water): add CustomAmountSheet for long-press custom input"
```

---

### Task 3: Rewrite Water Screen

**Files:**
- Rewrite: `app/(tabs)/water.tsx`

- [ ] **Step 3.1: Rewrite water.tsx**

Replace the entire contents of `app/(tabs)/water.tsx`:

```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useHydration } from '../../hooks/useHydration';
import { useFasting } from '../../hooks/useFasting';
import { WaterFillCircle } from '../../components/water/WaterFillCircle';
import { CustomAmountSheet } from '../../components/water/CustomAmountSheet';
import { PHASE_HYDRATION_TIPS } from '../../constants/hydration';

export default function WaterScreen() {
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

  const { isActive, currentPhase } = useFasting();

  const remainingMl = Math.max(dailyGoalMl - todayTotalMl, 0);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Goal celebration: notification + haptic when crossing 100%
  const prevRatio = useRef(progressRatio);
  useEffect(() => {
    if (prevRatio.current < 1 && progressRatio >= 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Goal Reached!',
          body: `You've had ${todayTotalMl}ml today`,
        },
        trigger: null,
      });
    }
    prevRatio.current = progressRatio;
  }, [progressRatio, todayTotalMl]);

  // Auto-dismiss snackbar
  useEffect(() => {
    if (!snackbar.visible) return;
    const timer = setTimeout(dismissSnackbar, 4000);
    return () => clearTimeout(timer);
  }, [snackbar.visible, dismissSnackbar]);

  const handleQuickAdd = useCallback(
    (amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      logWater(amount);
    },
    [logWater]
  );

  const handleCustomAdd = useCallback(
    (amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      logWater(amount);
    },
    [logWater]
  );

  const phaseTip = isActive
    ? PHASE_HYDRATION_TIPS[currentPhase.name] ?? null
    : null;

  return (
    <SafeAreaView edges={{ top: true, bottom: true }} style={{ flex: 1 }} className="bg-background">
      <View className="flex-1 px-6 pb-2">
        {/* Header */}
        <View className="pt-2">
          <Text className="text-text-primary text-2xl font-bold">Hydration</Text>
          {phaseTip && (
            <Text className="text-primary/80 text-xs font-medium mt-1">{phaseTip}</Text>
          )}
        </View>

        {/* Hero circle */}
        <View className="flex-1 items-center justify-center">
          <WaterFillCircle
            progressRatio={progressRatio}
            todayTotalMl={todayTotalMl}
            dailyGoalMl={dailyGoalMl}
            remainingMl={remainingMl}
            lastLoggedAt={lastLoggedAt}
          />
        </View>

        {/* Bottom section */}
        <View className="items-center">
          {/* Snackbar */}
          <View className="h-6 mb-3 justify-center">
            {snackbar.visible ? (
              <View className="flex-row items-center justify-center">
                <Text className="text-accent text-sm font-medium">{snackbar.message}</Text>
                {snackbar.lastLog && (
                  <Pressable
                    onPress={() => { undoLastLog(); dismissSnackbar(); }}
                    className="ml-2 px-2 py-0.5 rounded-md bg-primary/10"
                  >
                    <Text className="text-primary text-xs font-semibold">Undo</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text className="text-text-muted text-center text-sm">
                {Math.round(progressRatio * 100)}% of daily goal
              </Text>
            )}
          </View>

          {/* Pill buttons */}
          <View className="flex-row gap-3 mb-2">
            <Pressable
              className="h-12 px-8 rounded-full bg-primary items-center justify-center active:scale-95"
              style={{ shadowColor: '#2D6A4F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 }}
              onPress={() => handleQuickAdd(250)}
              onLongPress={() => setSheetVisible(true)}
              delayLongPress={400}
            >
              <Text className="text-white font-bold text-[15px]">+ 250ml</Text>
            </Pressable>
            <Pressable
              className="h-12 px-8 rounded-full bg-white border-[1.5px] border-gray-200 items-center justify-center active:scale-95"
              onPress={() => handleQuickAdd(500)}
              onLongPress={() => setSheetVisible(true)}
              delayLongPress={400}
            >
              <Text className="text-text-primary font-bold text-[15px]">+ 500ml</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <CustomAmountSheet
        visible={sheetVisible}
        onAdd={handleCustomAdd}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3.2: Verify full screen**

Run the app, navigate to Water tab. Verify:
1. Circle with animated wave renders, fills based on progress
2. Intake number animates on tap
3. "+250ml" and "+500ml" pill buttons work
4. Long-press either pill opens custom amount sheet
5. Snackbar with undo appears after logging
6. Snackbar auto-dismisses after 4s
7. Phase tip shows when fasting is active
8. Hitting 100% fires notification + haptic

- [ ] **Step 3.3: Commit**

```bash
git add "app/(tabs)/water.tsx"
git commit -m "feat(water): rewrite screen with fill circle, pill buttons, custom sheet"
```

---

### Task 4: Delete Old Components

**Files:**
- Delete: `components/water/FullScreenWave.tsx`
- Delete: `components/water/WaterPercentCircle.tsx`
- Delete: `components/water/QuickTapRow.tsx`
- Delete: `components/water/InlineStepper.tsx`
- Delete: `components/water/GoalCelebration.tsx`
- Delete: `components/water/UndoSnackbar.tsx` (if exists)

- [ ] **Step 4.1: Delete old files**

```bash
rm components/water/FullScreenWave.tsx
rm components/water/WaterPercentCircle.tsx
rm components/water/QuickTapRow.tsx
rm components/water/InlineStepper.tsx
rm components/water/GoalCelebration.tsx
rm -f components/water/UndoSnackbar.tsx
```

- [ ] **Step 4.2: Verify no broken imports**

Search for any remaining imports of the deleted files:

```bash
grep -r "FullScreenWave\|WaterPercentCircle\|QuickTapRow\|InlineStepper\|GoalCelebration\|UndoSnackbar" app/ components/ hooks/ --include="*.tsx" --include="*.ts"
```

Expected: no results (all old imports were removed in Task 3).

- [ ] **Step 4.3: Commit**

```bash
git add -A
git commit -m "chore(water): remove old water components replaced by redesign"
```

---

## Summary

| Before | After |
|--------|-------|
| Full-screen background wave | Wave inside the circle (clipped SVG) |
| WaterPercentCircle (% display) | WaterFillCircle (animated ml + wave fill) |
| QuickTapRow (rectangular buttons + Custom) | Two pill buttons, long-press for custom |
| InlineStepper (inline text input) | CustomAmountSheet (bottom sheet modal) |
| GoalCelebration (overlay animation) | Local notification + haptic |
| 6 component files | 2 component files |
