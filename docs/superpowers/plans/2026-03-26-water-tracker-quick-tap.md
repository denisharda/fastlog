# Water Tracker Quick-Tap Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FAB + bottom sheet water input with a quick-tap row (250ml, 500ml, custom) directly on the main screen.

**Architecture:** Two new components (QuickTapRow, InlineStepper) replace three old ones (AddWaterFAB, AddWaterSheet, WaterStatusBar). No data layer changes — both components call `useHydration.logWater()` directly. The water screen orchestrates state (stepper visibility) and passes callbacks.

**Tech Stack:** React Native, NativeWind, expo-haptics, LayoutAnimation

**Spec:** `docs/superpowers/specs/2026-03-26-water-tracker-quick-tap-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `constants/hydration.ts` | Update QUICK_ADD_AMOUNTS to [250, 500] |
| Create | `components/water/QuickTapRow.tsx` | 250ml / 500ml / More button row |
| Create | `components/water/InlineStepper.tsx` | Expandable −/+ stepper with confirm button |
| Modify | `app/(tabs)/water.tsx` | Wire new components, remove old ones |
| Delete | `components/water/AddWaterFAB.tsx` | Replaced by QuickTapRow |
| Delete | `components/water/AddWaterSheet.tsx` | Replaced by QuickTapRow + InlineStepper |
| Delete | `components/water/WaterStatusBar.tsx` | Replaced by inline text |

---

### Task 1: Update constants

**Files:**
- Modify: `constants/hydration.ts:2`

- [ ] **Step 1: Update QUICK_ADD_AMOUNTS**

In `constants/hydration.ts`, change line 2:

```typescript
export const QUICK_ADD_AMOUNTS = [250, 500] as const;
```

- [ ] **Step 2: Commit**

```bash
git add constants/hydration.ts
git commit -m "refactor: update QUICK_ADD_AMOUNTS to [250, 500] for quick-tap row"
```

---

### Task 2: Create QuickTapRow component

**Files:**
- Create: `components/water/QuickTapRow.tsx`

- [ ] **Step 1: Create QuickTapRow**

```tsx
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { QUICK_ADD_AMOUNTS } from '../../constants/hydration';

const ICONS = ['🥤', '🫗'] as const;

interface QuickTapRowProps {
  onQuickAdd: (amountMl: number) => void;
  onToggleMore: () => void;
  moreExpanded: boolean;
}

export function QuickTapRow({ onQuickAdd, onToggleMore, moreExpanded }: QuickTapRowProps) {
  function handleQuickAdd(amount: number) {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onQuickAdd(amount);
  }

  return (
    <View className="flex-row gap-2.5">
      {QUICK_ADD_AMOUNTS.map((amount, i) => (
        <Pressable
          key={amount}
          className={`flex-1 h-[52px] rounded-2xl items-center justify-center active:scale-95 ${
            i === 0
              ? 'bg-water'
              : 'bg-white border-[1.5px] border-gray-200'
          }`}
          style={i === 0 ? { shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 } : undefined}
          onPress={() => handleQuickAdd(amount)}
          accessibilityLabel={`Add ${amount} milliliters`}
          accessibilityRole="button"
        >
          <Text className={`text-xs ${i === 0 ? 'text-white' : ''}`}>{ICONS[i]}</Text>
          <Text className={`font-bold text-[13px] ${i === 0 ? 'text-white' : 'text-text-primary'}`}>
            +{amount}ml
          </Text>
        </Pressable>
      ))}
      <Pressable
        className={`w-[52px] h-[52px] rounded-2xl items-center justify-center border-[1.5px] active:scale-95 ${
          moreExpanded ? 'bg-water/10 border-water' : 'bg-white border-gray-200'
        }`}
        onPress={onToggleMore}
        accessibilityLabel="Custom amount"
        accessibilityRole="button"
      >
        <Text className="text-[10px]">⚙️</Text>
        <Text className={`font-semibold text-[8px] ${moreExpanded ? 'text-water' : 'text-text-muted'}`}>
          More
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep -i QuickTapRow || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add components/water/QuickTapRow.tsx
git commit -m "feat: add QuickTapRow component for water quick-tap buttons"
```

---

### Task 3: Create InlineStepper component

**Files:**
- Create: `components/water/InlineStepper.tsx`

- [ ] **Step 1: Create InlineStepper**

```tsx
import { useState, useEffect } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  WATER_STEPPER_INCREMENT_ML,
  MIN_ADD_AMOUNT_ML,
  MAX_ADD_AMOUNT_ML,
  DEFAULT_ADD_AMOUNT_ML,
} from '../../constants/hydration';

interface InlineStepperProps {
  visible: boolean;
  onAdd: (amountMl: number) => void;
  onCollapse: () => void;
}

export function InlineStepper({ visible, onAdd, onCollapse }: InlineStepperProps) {
  const [amount, setAmount] = useState(DEFAULT_ADD_AMOUNT_ML);

  // Reset amount when stepper is re-opened
  useEffect(() => {
    if (visible) {
      setAmount(DEFAULT_ADD_AMOUNT_ML);
    }
  }, [visible]);

  if (!visible) return null;

  function increment() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAmount((prev) => Math.min(prev + WATER_STEPPER_INCREMENT_ML, MAX_ADD_AMOUNT_ML));
  }

  function decrement() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAmount((prev) => Math.max(prev - WATER_STEPPER_INCREMENT_ML, MIN_ADD_AMOUNT_ML));
  }

  function handleAdd() {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdd(amount);
    setAmount(DEFAULT_ADD_AMOUNT_ML);
    onCollapse();
  }

  return (
    <View
      className="bg-white rounded-2xl p-3 border-[1.5px] border-gray-200 mt-2"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-center justify-center gap-4">
        <Pressable
          className="w-9 h-9 rounded-full bg-background items-center justify-center active:scale-95"
          onPress={decrement}
          accessibilityLabel="Decrease amount"
          accessibilityRole="button"
        >
          <Text className="text-text-primary text-lg font-medium">−</Text>
        </Pressable>
        <Text className="text-text-primary text-[22px] font-bold min-w-[70px] text-center">
          {amount}ml
        </Text>
        <Pressable
          className="w-9 h-9 rounded-full bg-background items-center justify-center active:scale-95"
          onPress={increment}
          accessibilityLabel="Increase amount"
          accessibilityRole="button"
        >
          <Text className="text-text-primary text-lg font-medium">+</Text>
        </Pressable>
      </View>
      <Pressable
        className="bg-water rounded-xl h-11 items-center justify-center mt-2 active:scale-[0.98]"
        onPress={handleAdd}
        accessibilityRole="button"
      >
        <Text className="text-white font-semibold text-sm">Add {amount}ml</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep -i InlineStepper || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add components/water/InlineStepper.tsx
git commit -m "feat: add InlineStepper component for custom water amounts"
```

---

### Task 4: Rewire water screen

**Files:**
- Modify: `app/(tabs)/water.tsx`

- [ ] **Step 1: Rewrite water.tsx**

Replace the entire file with:

```tsx
import { useState, useCallback } from 'react';
import { View, Text, LayoutAnimation, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHydration } from '../../hooks/useHydration';
import { FullScreenWave } from '../../components/water/FullScreenWave';
import { WaterPercentCircle } from '../../components/water/WaterPercentCircle';
import { QuickTapRow } from '../../components/water/QuickTapRow';
import { InlineStepper } from '../../components/water/InlineStepper';
import { UndoSnackbar } from '../../components/water/UndoSnackbar';

export default function WaterScreen() {
  const { width, height } = useWindowDimensions();
  const [stepperVisible, setStepperVisible] = useState(false);

  const {
    todayTotalMl,
    dailyGoalMl,
    progressRatio,
    logWater,
    undoLastLog,
    snackbar,
    dismissSnackbar,
  } = useHydration();

  const remainingMl = Math.max(dailyGoalMl - todayTotalMl, 0);

  const handleToggleMore = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible((prev) => !prev);
  }, []);

  const handleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible(false);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FullScreenWave progress={progressRatio} width={width} height={height} />

      <View className="flex-1 justify-between py-8 px-6">
        {/* Header */}
        <Text className="text-text-primary text-2xl font-bold">Hydration</Text>

        {/* Center circle */}
        <View className="flex-1 justify-center items-center">
          <WaterPercentCircle
            progressRatio={progressRatio}
            remainingMl={remainingMl}
          />
        </View>

        {/* Status text */}
        <Text className="text-text-muted text-center text-sm mb-3">
          {todayTotalMl} <Text className="text-text-muted/40">/</Text> {dailyGoalMl} ml
        </Text>

        {/* Quick-tap row */}
        <QuickTapRow
          onQuickAdd={logWater}
          onToggleMore={handleToggleMore}
          moreExpanded={stepperVisible}
        />

        {/* Inline stepper */}
        <InlineStepper
          visible={stepperVisible}
          onAdd={logWater}
          onCollapse={handleCollapse}
        />
      </View>

      <UndoSnackbar
        message={snackbar.message}
        visible={snackbar.visible}
        onUndo={undoLastLog}
        onDismiss={dismissSnackbar}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep -i water || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/water.tsx
git commit -m "feat: rewire water screen with quick-tap row and inline stepper"
```

---

### Task 5: Delete replaced components

**Files:**
- Delete: `components/water/AddWaterFAB.tsx`
- Delete: `components/water/AddWaterSheet.tsx`
- Delete: `components/water/WaterStatusBar.tsx`

- [ ] **Step 1: Delete files**

```bash
rm components/water/AddWaterFAB.tsx components/water/AddWaterSheet.tsx components/water/WaterStatusBar.tsx
```

- [ ] **Step 2: Verify no import errors**

Run: `npx tsc --noEmit 2>&1 | grep -E "AddWater|WaterStatus" || echo "No broken imports"`

- [ ] **Step 3: Commit**

```bash
git add -u components/water/
git commit -m "chore: remove replaced water input components (FAB, sheet, status bar)"
```

---

### Task 6: Manual verification

- [ ] **Step 1:** Run `npx expo start` and open water tab
- [ ] **Step 2:** Tap 250ml → wave updates, snackbar shows "Added 250ml", haptic fires
- [ ] **Step 3:** Tap 500ml → same behavior with 500ml
- [ ] **Step 4:** Tap Undo → log removed, wave drops back
- [ ] **Step 5:** Tap "More" → inline stepper expands with animation
- [ ] **Step 6:** Adjust to 350ml, tap "Add 350ml" → logs, stepper collapses
- [ ] **Step 7:** Tap "More" again without adding → stepper collapses (toggle)
- [ ] **Step 8:** Verify goal-reached state (checkmark in circle) still works
