# Water Tracker — Quick-Tap Redesign

## Context

The current water tracker uses a FAB button that opens a bottom sheet with three redundant input methods (stepper, slider, quick-add pills). This creates unnecessary friction for what should be a one-tap action. The user typically logs the same amount each time.

## Design

Replace the bottom sheet flow with a quick-tap row directly on the main screen. One tap logs water — no modal, no decisions.

### Layout (top to bottom)

1. **Header**: "Hydration" title (unchanged)
2. **Wave animation + percent circle**: Existing FullScreenWave and WaterPercentCircle (unchanged)
3. **Status text**: Simplified inline text — `1350 / 2000 ml` (replaces WaterStatusBar card)
4. **Quick-tap row**: Three buttons in a horizontal row
   - **250ml** (primary, blue `#0EA5E9` background, `🥤` icon) — flex: 1
   - **500ml** (secondary, white with border) — flex: 1
   - **More** (small square, `⚙️` icon, toggles inline stepper) — fixed 52px width
5. **Inline stepper** (conditionally visible when "More" is tapped):
   - White card with `−` / amount / `+` row (±50ml increments, range 50–1500ml)
   - Full-width "Add Xml" confirm button below the stepper
   - Tapping "More" again or tapping "Add" collapses it
6. **Undo snackbar**: Existing UndoSnackbar (unchanged behavior, repositioned above tab bar)

### Interaction Flow

**Quick log (primary path)**:
1. Tap 250ml or 500ml button
2. Haptic feedback fires (`Haptics.impactAsync`)
3. Water is logged immediately (local-first, async Supabase insert)
4. Wave animation updates
5. Undo snackbar appears (auto-dismiss after 4s)

**Custom amount (secondary path)**:
1. Tap "More" button
2. Inline stepper card expands below the quick-tap row (animated height)
3. Use −/+ to adjust amount (±50ml, range 50–1500ml, default 250ml)
4. Tap "Add Xml" to log
5. Stepper collapses, undo snackbar appears

### Components to Remove

- `components/water/AddWaterFAB.tsx` — no longer needed (remove from screen, keep file)
- `components/water/AddWaterSheet.tsx` — no longer needed (remove from screen, keep file)
- `components/water/WaterStatusBar.tsx` — replaced by inline text

### Components to Create

- `components/water/QuickTapRow.tsx` — the 250ml / 500ml / More button row
- `components/water/InlineStepper.tsx` — the expandable −/+ stepper card

### Components Unchanged

- `components/water/FullScreenWave.tsx`
- `components/water/WaterPercentCircle.tsx`
- `components/water/UndoSnackbar.tsx`

### Files to Modify

- `app/(tabs)/water.tsx` — remove FAB, sheet, and status bar imports/usage; add QuickTapRow and InlineStepper; replace WaterStatusBar with inline Text; reposition UndoSnackbar

### Data Flow

No changes to data layer. `useHydration` hook's `logWater(amountMl)` is called directly from QuickTapRow and InlineStepper button presses instead of from AddWaterSheet.

### Constants

Reuse existing from `constants/hydration.ts`:
- `WATER_STEPPER_INCREMENT_ML` (50) — for inline stepper
- `MIN_ADD_AMOUNT_ML` (50) — stepper min
- `MAX_ADD_AMOUNT_ML` (1500) — stepper max
- `DEFAULT_ADD_AMOUNT_ML` (250) — stepper default

Update `QUICK_ADD_AMOUNTS` in `constants/hydration.ts` from `[100, 250, 500, 750]` to `[250, 500]`. QuickTapRow reads from this constant so presets stay centralized.

### Accessibility

- 250ml button: `accessibilityLabel="Add 250 milliliters"`, `accessibilityRole="button"`
- 500ml button: `accessibilityLabel="Add 500 milliliters"`, `accessibilityRole="button"`
- More button: `accessibilityLabel="Custom amount"`, `accessibilityRole="button"`
- Stepper −: `accessibilityLabel="Decrease amount"`, `accessibilityRole="button"`
- Stepper +: `accessibilityLabel="Increase amount"`, `accessibilityRole="button"`

### Animations

- Quick-tap buttons: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`
- Inline stepper expand/collapse: `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`

### Removed Components

Delete `AddWaterFAB.tsx`, `AddWaterSheet.tsx`, and `WaterStatusBar.tsx` — they are fully replaced. No rollback path needed; git history preserves them.

## Verification

1. Open water tab — should see quick-tap row instead of FAB
2. Tap 250ml — wave updates, snackbar shows "Added 250ml", haptic fires
3. Tap 500ml — same behavior with 500ml
4. Tap Undo on snackbar — log is removed, wave drops back
5. Tap "More" — inline stepper expands with animation
6. Adjust stepper to 350ml, tap "Add 350ml" — logs correctly, stepper collapses
7. Tap "More" again without adding — stepper collapses (toggle behavior)
8. Verify wave animation still fills correctly at various progress levels
9. Verify goal-reached state (checkmark in circle) still works
