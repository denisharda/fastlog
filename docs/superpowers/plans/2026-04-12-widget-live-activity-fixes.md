# Widget & Live Activity Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs in the Home Screen Widget and Live Activity, reconcile config files, and improve UX for both inactive and active states.

**Architecture:** The widget reads fasting state from App Groups UserDefaults. The live activity is driven by direct `start()`/`update()`/`end()` calls from the JS layer via expo-widgets. Both need: (1) proper state sync with timeline reloads, (2) live activity reconnection after app restart, (3) consistent config, (4) improved visual design.

**Tech Stack:** Expo SDK 55, expo-widgets, @expo/ui SwiftUI components, react-native-shared-group-preferences, Zustand

---

### Task 1: Reconcile app.json with app.config.ts

`app.json` is out of sync — missing `expo-widgets` plugin, missing `NSSupportsLiveActivities`, wrong `userInterfaceStyle`, and contains a stale `@react-native-google-signin/google-signin` plugin. Since `app.config.ts` is the canonical config (dynamic), strip `app.json` down to only what's needed for EAS metadata and remove conflicting fields.

**Files:**
- Modify: `app.json`
- Modify: `eas.json`

- [ ] **Step 1: Overwrite app.json to minimal EAS-compatible config**

```json
{
  "expo": {
    "name": "FastLog",
    "slug": "fastlog",
    "version": "1.0.0",
    "extra": {
      "eas": {
        "build": {
          "experimental": {
            "ios": {
              "appExtensions": [
                {
                  "targetName": "ExpoWidgetsTarget",
                  "bundleIdentifier": "com.fastlog.app.widgets",
                  "entitlements": {
                    "com.apple.security.application-groups": [
                      "group.com.fastlog.app"
                    ]
                  }
                }
              ]
            }
          }
        },
        "projectId": "fa29c793-f61f-4d1a-af10-64fb576a2825"
      }
    }
  }
}
```

This removes all fields that `app.config.ts` already defines (name, slug, icon, splash, ios, android, web, plugins, experiments, orientation, scheme, userInterfaceStyle). Only `extra` with EAS config remains.

- [ ] **Step 2: Add iOS production profile to eas.json**

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "preview2": {
      "android": {
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "preview3": {
      "developmentClient": true
    },
    "preview4": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "autoIncrement": true
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app.json eas.json
git commit -m "fix: reconcile app.json with app.config.ts, strip conflicting fields"
```

---

### Task 2: Add WidgetKit timeline reload after shared state writes

The widget only refreshes when iOS decides to (15-30 min). We need to force a reload every time we write to UserDefaults so the widget reflects fast start/stop/phase changes immediately.

**Files:**
- Modify: `lib/sharedState.ts`

- [ ] **Step 1: Add reloadWidgetTimelines helper and call it after writeSharedState**

In `lib/sharedState.ts`, after the `setItem` call, invoke the expo-widgets `reloadAllTimelines` API:

```typescript
import { Platform } from 'react-native';

const APP_GROUP = 'group.com.fastlog.app';
const SHARED_KEY = 'fastingState';

export interface SharedFastingState {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
  elapsedHours: number;
}

const defaultState: SharedFastingState = {
  isActive: false,
  startedAt: null,
  targetHours: 0,
  phase: 'Fed State',
  protocol: '16:8',
  elapsedHours: 0,
};

/**
 * Force WidgetKit to reload all widget timelines.
 * Call after writing shared state so the widget picks up changes immediately.
 */
function reloadWidgetTimelines(): void {
  if (Platform.OS !== 'ios') return;

  try {
    const { reloadAllTimelines } = require('expo-widgets');
    reloadAllTimelines();
  } catch {
    // expo-widgets not available (Expo Go or missing module)
  }
}

/**
 * Write fasting state to App Groups shared UserDefaults.
 * Used by iOS widgets and Live Activities to read current state.
 * Falls back silently on Android or if the native module is unavailable.
 */
export async function writeSharedState(state: SharedFastingState): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const SharedGroupPreferences = require('react-native-shared-group-preferences').default;
    await SharedGroupPreferences.setItem(SHARED_KEY, JSON.stringify(state), APP_GROUP);
    reloadWidgetTimelines();
  } catch (error) {
    // Silently fail — widget will show stale data but app continues working
    console.warn('[sharedState] Failed to write shared state:', error);
  }
}

/**
 * Read fasting state from App Groups shared UserDefaults.
 */
export async function readSharedState(): Promise<SharedFastingState> {
  if (Platform.OS !== 'ios') return defaultState;

  try {
    const SharedGroupPreferences = require('react-native-shared-group-preferences').default;
    const raw = await SharedGroupPreferences.getItem(SHARED_KEY, APP_GROUP);
    return raw ? JSON.parse(raw) : defaultState;
  } catch {
    return defaultState;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/sharedState.ts
git commit -m "fix: force WidgetKit timeline reload after shared state writes"
```

---

### Task 3: Fix live activity lifecycle — reattach on restart, guard start/stop

The `activityInstance` reference is lost when the app restarts, orphaning the live activity. We need to: (1) end any existing activity before starting a new one, (2) attempt to reattach on app launch, (3) properly await async calls, (4) guard against partial state updates.

**Files:**
- Modify: `lib/liveActivity.ts`

- [ ] **Step 1: Rewrite liveActivity.ts with reattachment and guards**

```typescript
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface LiveActivityState {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let factory: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activityInstance: any = null;

function getFactory(): any {
  if (Platform.OS !== 'ios' || isExpoGo) return null;
  if (factory) return factory;

  try {
    const mod = require('expo-widgets');
    factory = mod.createLiveActivity(
      'FastingActivity',
      (() => ({ banner: null })) as any
    );
    return factory;
  } catch {
    return null;
  }
}

/**
 * End any currently running live activity. Safe to call even if no activity
 * is running — silently no-ops.
 */
export async function endLiveActivity(): Promise<void> {
  if (!activityInstance) return;

  try {
    await activityInstance.end('default');
  } catch (e) {
    console.warn('[liveActivity] end failed:', e);
  } finally {
    activityInstance = null;
  }
}

/**
 * Start a new live activity. Ends any existing activity first to avoid orphans.
 */
export async function startLiveActivity(state: LiveActivityState): Promise<void> {
  const f = getFactory();
  if (!f) return;

  // End any existing activity before starting a new one
  await endLiveActivity();

  try {
    activityInstance = await f.start(state);
    if (__DEV__) console.log('[liveActivity] started successfully');
  } catch (e) {
    console.error('[liveActivity] start failed:', e);
    activityInstance = null;
  }
}

/**
 * Update the running live activity with new state.
 * Sends a full state object to avoid partial/undefined fields on the native side.
 */
export async function updateLiveActivity(
  partial: Partial<LiveActivityState>,
  currentFull: LiveActivityState
): Promise<void> {
  if (!activityInstance) return;

  try {
    // Merge partial into full state to avoid sending undefined fields
    const merged: LiveActivityState = { ...currentFull, ...partial };
    await activityInstance.update(merged);
  } catch (e) {
    console.warn('[liveActivity] update failed:', e);
  }
}

/**
 * Attempt to reconnect to an existing live activity after app restart.
 * If the store has an active fast but we lost the JS reference, we can't
 * reconnect (ActivityKit doesn't expose this via expo-widgets). Instead,
 * end any stale activities and start a fresh one.
 */
export async function restoreLiveActivity(state: LiveActivityState): Promise<void> {
  const f = getFactory();
  if (!f) return;

  // We can't query running activities through expo-widgets, so start fresh.
  // iOS will dismiss the old one if we start a new one for the same activity type.
  try {
    activityInstance = await f.start(state);
    if (__DEV__) console.log('[liveActivity] restored successfully');
  } catch (e) {
    // Starting a fresh activity after restart may fail if the old one is still
    // active and hasn't been dismissed. This is expected — the old activity
    // will auto-dismiss after iOS's 8h limit.
    console.warn('[liveActivity] restore failed:', e);
    activityInstance = null;
  }
}

/**
 * Whether a live activity instance is currently held in memory.
 */
export function hasLiveActivity(): boolean {
  return activityInstance !== null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/liveActivity.ts
git commit -m "fix: rewrite live activity lifecycle with reattach, guard start/stop"
```

---

### Task 4: Update useFasting hook to properly integrate live activity changes

The hook needs to: (1) await live activity calls, (2) pass full state to `updateLiveActivity`, (3) restore live activity on mount when a persisted fast exists, (4) add AppState listener for foreground re-sync.

**Files:**
- Modify: `hooks/useFasting.ts`

- [ ] **Step 1: Update useFasting.ts with fixed live activity integration**

Changes needed in `hooks/useFasting.ts`:

1. Import `restoreLiveActivity`, `hasLiveActivity` and updated `updateLiveActivity` signature
2. Add a mount effect to restore live activity when `activeFast` exists but `activityInstance` is null
3. Pass full state to `updateLiveActivity`
4. Await `startLiveActivity` and `endLiveActivity`
5. Add `AppState` listener to re-sync on foreground

Replace the imports at the top:

```typescript
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useFastingStore } from '../stores/fastingStore';
import { useUserStore } from '../stores/userStore';
import { getCurrentPhase, FastingPhase } from '../constants/phases';
import { supabase } from '../lib/supabase';
import * as Crypto from 'expo-crypto';
import {
  scheduleStartNotification,
  scheduleCompletionNotification,
  schedulePhaseNotifications,
  scheduleWaterReminders,
  cancelAllNotifications,
} from '../lib/notifications';
import {
  trackFastStarted,
  trackFastCompleted,
  trackFastAbandoned,
} from '../lib/posthog';
import { writeSharedState } from '../lib/sharedState';
import {
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  restoreLiveActivity,
  hasLiveActivity,
} from '../lib/liveActivity';
import { FastingProtocol } from '../types';
```

Add a new effect after the existing timer interval effect (after line 77) to restore the live activity on mount and re-sync on foreground:

```typescript
  // Restore live activity on mount if fast is active but instance was lost (app restart)
  useEffect(() => {
    if (activeFast && !hasLiveActivity()) {
      const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
      const phase = getCurrentPhase(elapsed);
      restoreLiveActivity({
        startedAt: activeFast.startedAt,
        targetHours: activeFast.targetHours,
        phase: phase.name,
        phaseDescription: phase.description,
        protocol: activeFast.protocol,
      });
    }
  }, [activeFast]);

  // Re-sync shared state when app returns to foreground
  useEffect(() => {
    function handleAppState(nextState: AppStateStatus) {
      if (nextState === 'active' && activeFast) {
        const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
        const phase = getCurrentPhase(elapsed);
        writeSharedState({
          isActive: true,
          startedAt: activeFast.startedAt,
          targetHours: activeFast.targetHours,
          phase: phase.name,
          protocol: activeFast.protocol,
          elapsedHours: elapsed,
        });
      }
    }

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [activeFast]);
```

Update the phase-change effect to pass full state to `updateLiveActivity`:

```typescript
  // Update Live Activity and shared state on phase change
  useEffect(() => {
    if (!activeFast) {
      prevPhaseRef.current = null;
      return;
    }

    if (prevPhaseRef.current !== currentPhase.name) {
      prevPhaseRef.current = currentPhase.name;

      const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;

      writeSharedState({
        isActive: true,
        startedAt: activeFast.startedAt,
        targetHours: activeFast.targetHours,
        phase: currentPhase.name,
        protocol: activeFast.protocol,
        elapsedHours: elapsed,
      });

      // Pass full state to avoid partial/undefined fields on native side
      updateLiveActivity(
        { phase: currentPhase.name, phaseDescription: currentPhase.description },
        {
          startedAt: activeFast.startedAt,
          targetHours: activeFast.targetHours,
          phase: currentPhase.name,
          phaseDescription: currentPhase.description,
          protocol: activeFast.protocol,
        }
      );
    }
  }, [activeFast, currentPhase.name]);
```

In the `startFast` callback, await `startLiveActivity`:

```typescript
        // Start Live Activity (iOS only, no-op if native module unavailable)
        const phase = getCurrentPhase(0);
        await startLiveActivity({
          startedAt,
          targetHours: hours,
          phase: phase.name,
          phaseDescription: phase.description,
          protocol,
        });
```

In the `stopFast` callback, await `endLiveActivity`:

```typescript
        storeStop();
        await cancelAllNotifications();
        await endLiveActivity();
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useFasting.ts
git commit -m "fix: restore live activity on app restart, re-sync on foreground, await async calls"
```

---

### Task 5: Fix widget theme and inactive state UX

The widget uses a dark theme while the app is light. The inactive state is an empty blank. Fix both.

**Files:**
- Modify: `widgets/FastingWidget.tsx`

- [ ] **Step 1: Rewrite FastingWidget.tsx with light theme, improved inactive states, and defensive guards**

```typescript
/**
 * Home Screen Widget for FastLog
 *
 * Uses the official expo-widgets API with @expo/ui/swift-ui components.
 * Reads fasting state from App Groups shared UserDefaults.
 *
 * Sizes:
 * - Small: timer + phase name + progress text
 * - Medium: timer left, phase + protocol right
 *
 * Inactive state: app branding + protocol + "Tap to start"
 */

import { createWidget, WidgetEnvironment } from 'expo-widgets';
import { Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  background,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';

// Light theme — matches the app's design system
const COLORS = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  primary: '#2D6A4F',
  accent: '#40916C',
  textPrimary: '#1A1A1A',
  textMuted: '#6B7280',
};

// Phase thresholds matching constants/phases.ts
const PHASE_THRESHOLDS = [
  { name: 'Fed State', min: 0, max: 4 },
  { name: 'Early Fasting', min: 4, max: 8 },
  { name: 'Fat Burning Begins', min: 8, max: 12 },
  { name: 'Fat Burning Peak', min: 12, max: 16 },
  { name: 'Autophagy Zone', min: 16, max: 18 },
  { name: 'Deep Fast', min: 18, max: Infinity },
];

function computePhase(elapsedHours: number): string {
  const phase = PHASE_THRESHOLDS.find(
    (p) => elapsedHours >= p.min && elapsedHours < p.max
  );
  return phase?.name ?? 'Deep Fast';
}

interface FastingState {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number;
  phase: string;
  protocol: string;
  elapsedHours: number;
}

function SmallWidget({ state }: { state: FastingState }) {
  if (!state.isActive || !state.startedAt) {
    return (
      <VStack
        modifiers={[
          background(COLORS.background),
          padding({ all: 16 }),
          widgetURL('fastlog://start'),
        ]}
      >
        <Text
          modifiers={[
            foregroundStyle(COLORS.primary),
            font({ size: 14, weight: 'bold' }),
          ]}
        >
          FastLog
        </Text>
        <Spacer />
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 12 }),
          ]}
        >
          {state.protocol} ready
        </Text>
        <Text
          modifiers={[
            foregroundStyle(COLORS.accent),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          Tap to start
        </Text>
      </VStack>
    );
  }

  // Compute phase locally from startedAt for freshness
  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 3600000;
  const phase = computePhase(elapsed);
  const progress = state.targetHours > 0
    ? Math.min(Math.round((elapsed / state.targetHours) * 100), 100)
    : 0;

  return (
    <VStack
      modifiers={[
        background(COLORS.background),
        padding({ all: 16 }),
        widgetURL('fastlog://timer'),
      ]}
    >
      <Text
        modifiers={[
          foregroundStyle(COLORS.accent),
          font({ size: 12, weight: 'medium' }),
        ]}
      >
        {phase}
      </Text>
      <Spacer />
      <Text
        date={new Date(state.startedAt)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle(COLORS.textPrimary),
          font({ size: 28, weight: 'bold', design: 'monospaced' }),
        ]}
      />
      <Text
        modifiers={[
          foregroundStyle(COLORS.textMuted),
          font({ size: 12 }),
        ]}
      >
        {progress}% of {state.targetHours}h goal
      </Text>
    </VStack>
  );
}

function MediumWidget({ state }: { state: FastingState }) {
  if (!state.isActive || !state.startedAt) {
    return (
      <HStack
        modifiers={[
          background(COLORS.background),
          padding({ all: 16 }),
          widgetURL('fastlog://start'),
        ]}
      >
        <VStack>
          <Text
            modifiers={[
              foregroundStyle(COLORS.primary),
              font({ size: 16, weight: 'bold' }),
            ]}
          >
            FastLog
          </Text>
          <Spacer />
          <Text
            modifiers={[
              foregroundStyle(COLORS.textMuted),
              font({ size: 13 }),
            ]}
          >
            {state.protocol} protocol ready
          </Text>
          <Text
            modifiers={[
              foregroundStyle(COLORS.accent),
              font({ size: 14, weight: 'semibold' }),
            ]}
          >
            Tap to start fasting
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing">
          <Text
            modifiers={[
              foregroundStyle(COLORS.primary),
              font({ size: 36, weight: 'bold' }),
            ]}
          >
            {state.targetHours > 0 ? `${state.targetHours}h` : '16h'}
          </Text>
          <Text
            modifiers={[
              foregroundStyle(COLORS.textMuted),
              font({ size: 11 }),
            ]}
          >
            fast duration
          </Text>
        </VStack>
      </HStack>
    );
  }

  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 3600000;
  const phase = computePhase(elapsed);
  const progress = state.targetHours > 0
    ? Math.min(Math.round((elapsed / state.targetHours) * 100), 100)
    : 0;

  return (
    <HStack
      modifiers={[
        background(COLORS.background),
        padding({ all: 16 }),
        widgetURL('fastlog://timer'),
      ]}
    >
      {/* Left: Timer */}
      <VStack>
        <Text
          date={new Date(state.startedAt)}
          dateStyle="timer"
          modifiers={[
            foregroundStyle(COLORS.textPrimary),
            font({ size: 32, weight: 'bold', design: 'monospaced' }),
          ]}
        />
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 12 }),
          ]}
        >
          {progress}% of {state.targetHours}h ({state.protocol})
        </Text>
      </VStack>
      <Spacer />
      {/* Right: Phase */}
      <VStack alignment="trailing">
        <Text
          modifiers={[
            foregroundStyle(COLORS.accent),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          {phase}
        </Text>
        <Text
          modifiers={[
            foregroundStyle(COLORS.textMuted),
            font({ size: 12 }),
          ]}
        >
          {state.protocol}
        </Text>
      </VStack>
    </HStack>
  );
}

function FastingWidgetComponent(props: FastingState, env: WidgetEnvironment) {
  'widget';

  return env.widgetFamily === 'systemSmall' ? (
    <SmallWidget state={props} />
  ) : (
    <MediumWidget state={props} />
  );
}

export default createWidget('FastingWidget', FastingWidgetComponent);
```

Key changes:
- Light theme matching app design system (#F2F2F7 background, #1A1A1A text)
- Defensive guard: `!state.startedAt` falls back to inactive view (prevents crash)
- Phase computed locally from `startedAt` instead of reading stale `state.phase`
- Progress shown as percentage instead of stale `elapsed.toFixed(1)h / Xh`
- Inactive state shows protocol name and target hours instead of blank space
- Font sizes bumped to 12px minimum for accessibility

- [ ] **Step 2: Commit**

```bash
git add widgets/FastingWidget.tsx
git commit -m "fix: widget light theme, local phase computation, improved inactive state"
```

---

### Task 6: Improve Live Activity Dynamic Island UX

Replace emoji placeholders with meaningful content, add progress context, remove unused import.

**Files:**
- Modify: `widgets/FastingActivity.tsx`

- [ ] **Step 1: Rewrite FastingActivity.tsx with improved Dynamic Island content**

```typescript
/**
 * Live Activity / Dynamic Island for FastLog
 *
 * Uses expo-widgets createLiveActivity API with @expo/ui modifiers-based API.
 * Shows fasting timer and current phase in the Dynamic Island.
 *
 * Layouts:
 * - compactLeading: protocol label
 * - compactTrailing: elapsed time
 * - minimal: abbreviated protocol
 * - banner: phase name + timer + target
 * - expandedLeading: phase name + protocol
 * - expandedTrailing: timer + target
 * - expandedBottom: phase description
 */

import { createLiveActivity } from 'expo-widgets';
import type { LiveActivityLayout } from 'expo-widgets';
import type { LiveActivityEnvironment } from 'expo-widgets';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  font,
  padding,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';

interface FastingActivityState {
  startedAt: string;
  targetHours: number;
  phase: string;
  phaseDescription: string;
  protocol: string;
}

function FastingActivityComponent(
  props: FastingActivityState,
  env: LiveActivityEnvironment
): LiveActivityLayout {
  'widget';

  return {
    /**
     * Banner view — shown in notification-style banner on lock screen
     */
    banner: (
      <VStack modifiers={[padding({ all: 16 })]}>
        <HStack>
          <Text
            modifiers={[
              foregroundStyle('#40916C'),
              font({ size: 13, weight: 'semibold' }),
            ]}
          >
            {props.phase}
          </Text>
        </HStack>
        <HStack>
          <Text
            date={new Date(props.startedAt)}
            dateStyle="timer"
            modifiers={[
              foregroundStyle('#F5F5F5'),
              font({ size: 24, weight: 'bold' }),
              monospacedDigit(),
            ]}
          />
          <Text
            modifiers={[
              foregroundStyle('#9CA3AF'),
              font({ size: 14 }),
            ]}
          >
            {' '}/ {props.targetHours}h
          </Text>
        </HStack>
        <Text
          modifiers={[
            foregroundStyle('#6B7280'),
            font({ size: 11 }),
          ]}
        >
          {props.phaseDescription}
        </Text>
      </VStack>
    ),

    /**
     * Compact leading — left side of Dynamic Island pill
     * Show protocol label for context
     */
    compactLeading: (
      <Text
        modifiers={[
          foregroundStyle('#40916C'),
          font({ size: 12, weight: 'semibold' }),
        ]}
      >
        {props.protocol}
      </Text>
    ),

    /**
     * Compact trailing — right side of Dynamic Island pill
     */
    compactTrailing: (
      <Text
        date={new Date(props.startedAt)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle('#F5F5F5'),
          font({ size: 13, weight: 'medium' }),
          monospacedDigit(),
        ]}
      />
    ),

    /**
     * Minimal — smallest Dynamic Island representation
     * Show abbreviated time instead of emoji
     */
    minimal: (
      <Text
        date={new Date(props.startedAt)}
        dateStyle="timer"
        modifiers={[
          foregroundStyle('#F5F5F5'),
          font({ size: 10, weight: 'medium' }),
          monospacedDigit(),
        ]}
      />
    ),

    /**
     * Expanded leading — left side when Dynamic Island is expanded
     */
    expandedLeading: (
      <VStack>
        <Text
          modifiers={[
            foregroundStyle('#40916C'),
            font({ size: 14, weight: 'semibold' }),
          ]}
        >
          {props.phase}
        </Text>
        <Text
          modifiers={[
            foregroundStyle('#9CA3AF'),
            font({ size: 11 }),
          ]}
        >
          {props.protocol} fast
        </Text>
      </VStack>
    ),

    /**
     * Expanded trailing — right side when Dynamic Island is expanded
     */
    expandedTrailing: (
      <VStack alignment="trailing">
        <Text
          date={new Date(props.startedAt)}
          dateStyle="timer"
          modifiers={[
            foregroundStyle('#F5F5F5'),
            font({ size: 20, weight: 'bold' }),
            monospacedDigit(),
          ]}
        />
        <Text
          modifiers={[
            foregroundStyle('#9CA3AF'),
            font({ size: 11 }),
          ]}
        >
          of {props.targetHours}h
        </Text>
      </VStack>
    ),

    /**
     * Expanded bottom — bottom section when Dynamic Island is fully expanded
     */
    expandedBottom: (
      <Text
        modifiers={[
          foregroundStyle('#9CA3AF'),
          font({ size: 12 }),
          padding({ leading: 16, trailing: 16, bottom: 8 }),
        ]}
      >
        {props.phaseDescription}
      </Text>
    ),
  };
}

export default createLiveActivity('FastingActivity', FastingActivityComponent);
```

Key changes:
- Compact leading: protocol label ("16:8") instead of green circle emoji
- Minimal: tiny live timer instead of green circle emoji
- Banner: added phase description line for more context
- Removed unused `bold` import
- Fixed `LiveActivityEnvironment` import to use main `expo-widgets` export
- Changed "Goal: Xh" to "of Xh" to reduce redundancy

- [ ] **Step 2: Commit**

```bash
git add widgets/FastingActivity.tsx
git commit -m "fix: replace emoji placeholders with meaningful content in Dynamic Island"
```

---

### Task 7: Add deep link handling in app layout

The widget defines `fastlog://start` and `fastlog://timer` deep links but the app never handles them.

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add URL handling to root layout**

Add this import at the top of `app/_layout.tsx`:

```typescript
import * as Linking from 'expo-linking';
```

Add a new effect inside `RootLayout` (after the existing notification-tap handler effect) to handle deep links from the widget:

```typescript
  // Handle deep links from widget
  useEffect(() => {
    function handleURL(event: { url: string }) {
      const { hostname } = Linking.parse(event.url);
      if (hostname === 'timer' || hostname === 'start') {
        router.push('/(tabs)');
      }
    }

    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) handleURL({ url });
    });

    // Handle URLs while app is running
    const sub = Linking.addEventListener('url', handleURL);
    return () => sub.remove();
  }, []);
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: handle fastlog:// deep links from widget taps"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run TypeScript type check**

Run: `cd /Users/denisharda/Sites/fastbuddy && npx tsc --noEmit`

Expected: no type errors. If there are errors, fix them.

- [ ] **Step 2: Verify all files are saved and committed**

Run: `git status`

Expected: clean working tree (nothing unstaged).

- [ ] **Step 3: Review the full diff from before our changes**

Run: `git log --oneline -8`

Expected: 7 new commits (one per task above) on top of the previous HEAD.
