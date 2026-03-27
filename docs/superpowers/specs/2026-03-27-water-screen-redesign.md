# Water Screen Redesign — Design Spec

## Goal
Replace the current water tracking screen with a water-fill circle design that feels satisfying and alive.

## Layout (top to bottom)

1. **Header**: "Hydration" title + phase-aware hydration tip when fasting (from `PHASE_HYDRATION_TIPS`)
2. **Hero: WaterFillCircle**: Large circle (~220px) with an animated SVG wave inside. Wave level = `progressRatio`. Center content:
   - Large animated intake number (e.g. "1,250") — counts up on each log
   - "of 2,000ml" subtitle
   - "750ml to go" motivational text (or "Goal reached!" when done)
3. **Last drink timestamp**: Small text below circle — "Last drink: 5m ago" (from `lastLoggedAt`)
4. **Two pill buttons**: "+250ml" (filled primary green) and "+500ml" (outlined white). Horizontally centered with gap.
5. **Snackbar**: Inline undo text — "Added 250ml — 750ml to go  [Undo]" — appears above the pills for ~4s after logging.

## WaterFillCircle Component

New component: `components/water/WaterFillCircle.tsx`

- Renders a circle with white background and subtle shadow
- Inside the circle, an SVG wave path fills from bottom based on `progressRatio` (0-1)
- The wave gently oscillates horizontally using `Animated.Value` phase loop (4s cycle) — always alive
- Wave color: primary green gradient (`#2D6A4F` → `#40916C`, ~0.3 opacity)
- Center content rendered on top of the wave via absolute positioning
- The intake number animates from old value to new using `Animated.timing` (400ms)

Props:
```ts
interface WaterFillCircleProps {
  progressRatio: number;
  todayTotalMl: number;
  dailyGoalMl: number;
  remainingMl: number;
  lastLoggedAt: string | null;
}
```

## Pill Buttons

Two buttons side by side, centered below the circle.

- **+250ml**: `bg-primary`, white text, bold, rounded-full (pill shape), shadow
- **+500ml**: `bg-white`, border, dark text, rounded-full
- Both: `h-12 px-6 rounded-full` — pill shaped, not rectangular
- **Tap**: logs water, haptic (light impact), wave rises, number animates
- **Long-press**: opens a bottom sheet / modal with a `TextInput` for custom ml amount and an "Add" button. Replaces the old `InlineStepper`.

## Long-Press Custom Input

A simple modal/bottom sheet that appears on long-press of either pill button:
- TextInput with number-pad keyboard, placeholder "Enter ml"
- "Add" button (primary green, disabled until valid input 50-1500ml)
- Dismissible by tapping outside or pressing "Add"
- On add: same behavior as quick-tap (log, haptic, animate, snackbar)

Implementation: use React Native `Modal` with `transparent` background and a bottom-aligned card. No external library needed.

## Goal Celebration

When `progressRatio` crosses from <1 to >=1:
- Fire a local push notification: title "Goal Reached!", body "You've had {totalMl}ml today"
- Success haptic (`Haptics.notificationAsync(Success)`)
- No overlay animation — the wave filling to 100% is the visual reward

Use `expo-notifications` `scheduleNotificationAsync` with immediate trigger.

## Snackbar / Undo

Keep the existing inline snackbar pattern from the current screen — text + "Undo" pressable. Show above the pill buttons. Auto-dismiss after 4 seconds.

## Files to Create
- `components/water/WaterFillCircle.tsx` — the hero circle with animated wave fill
- `components/water/CustomAmountSheet.tsx` — long-press bottom sheet for custom input

## Files to Modify
- `app/(tabs)/water.tsx` — rewrite screen layout with new components
- `hooks/useHydration.ts` — no changes needed (already has `lastLoggedAt`)
- `constants/hydration.ts` — no changes needed (already has `PHASE_HYDRATION_TIPS`)

## Files to Delete
- `components/water/FullScreenWave.tsx` — replaced by wave inside circle
- `components/water/WaterPercentCircle.tsx` — replaced by `WaterFillCircle`
- `components/water/QuickTapRow.tsx` — replaced by inline pill buttons
- `components/water/InlineStepper.tsx` — replaced by `CustomAmountSheet`
- `components/water/GoalCelebration.tsx` — replaced by notification
- `components/water/UndoSnackbar.tsx` — if exists, replaced by inline snackbar in screen

## What stays the same
- `useHydration` hook — all data/logic unchanged
- `PHASE_HYDRATION_TIPS` — already added
- Tab layout (`disableAutomaticContentInsets` on water trigger)
- `SafeAreaView` wrapper with top+bottom edges
