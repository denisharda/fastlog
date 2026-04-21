# Share Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-text share + CSV export with a Pro-gated 1:1 image card centered on `PhaseRing`, rendered via `react-native-view-shot` and dispatched through the iOS share sheet.

**Architecture:** A pure presentational `ShareCard` component renders the card from live RN views using the existing `PhaseRing`. A `ShareCardPreviewSheet` (`BottomSheetModal`) previews the card and captures it to PNG via `captureRef`. A `lib/captureShareCard.ts` helper owns the capture-then-share flow (PostHog event + haptic). Two entry points wire in the sheet: `SessionDetailDrawer` (replaces existing text share) and `fast-complete.tsx` (replaces free plain-text link, now Pro-gated). CSV export is deleted entirely.

**Tech Stack:** React Native (Expo SDK 55), TypeScript strict, `react-native-view-shot` (new dep), `@gorhom/bottom-sheet`, `react-native-svg`, `expo-haptics`, PostHog RN, existing Amber Sunrise theme tokens from `constants/theme.ts`.

**Spec:** `docs/superpowers/specs/2026-04-21-share-card-design.md`

---

## File Structure

**New files (create in order):**
- `components/share/ShareCard.tsx` — presentational 1:1 card, `forwardRef<View>`
- `lib/captureShareCard.ts` — capture + share helper
- `components/share/ShareCardPreviewSheet.tsx` — bottom sheet owner

**Modified files:**
- `lib/posthog.ts` — widen `trackShareSession` signature, remove `trackHistoryExported`
- `components/history/SessionDetailDrawer.tsx` — replace `shareSession` call with sheet
- `app/fast-complete.tsx` — replace plain-text share with Pro-gated sheet button
- `app/(tabs)/history.tsx` — remove CSV export icon and "Export" inline link

**Deleted files:**
- `lib/shareSession.ts`
- `lib/exportHistory.ts`

---

## Task 1: Add `react-native-view-shot` dependency

**Files:**
- Modify: `package.json` (via install)

- [ ] **Step 1: Install the package**

```bash
npx expo install react-native-view-shot
```

Expected: `react-native-view-shot` appears in `dependencies` of `package.json` (typical version `~3.x` or `~4.x` — accept whatever `expo install` resolves).

- [ ] **Step 2: Rebuild iOS native project**

```bash
npx expo prebuild -p ios --clean
```

Expected: `ios/` regenerated. No errors.

- [ ] **Step 3: Verify the pod is installed**

```bash
grep -q "RNViewShot" ios/Podfile.lock && echo OK || echo MISSING
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add package.json ios/ yarn.lock package-lock.json 2>/dev/null
git commit -m "chore(deps): add react-native-view-shot for share card capture

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Widen `trackShareSession` and remove `trackHistoryExported`

**Files:**
- Modify: `lib/posthog.ts` (lines 97-103)

- [ ] **Step 1: Replace the two event helpers**

Replace this block:

```ts
export function trackShareSession(): void {
  posthogInstance?.capture('share_session');
}

export function trackHistoryExported(): void {
  posthogInstance?.capture('history_exported');
}
```

With:

```ts
export function trackShareSession(props: {
  source: 'history' | 'fast_complete';
  protocol: string;
  completed: boolean;
  duration_h: number;
}): void {
  posthogInstance?.capture('share_session', props);
}
```

(Delete `trackHistoryExported` entirely.)

- [ ] **Step 2: Typecheck (expected to fail at call sites)**

```bash
npx tsc --noEmit
```

Expected: errors at three call sites — `app/(tabs)/history.tsx` (references `trackHistoryExported`), `app/fast-complete.tsx` (zero-arg `trackShareSession()`), `components/history/SessionDetailDrawer.tsx` (zero-arg `trackShareSession()`). These will be fixed by later tasks. **Do not fix them yet** — leave the errors in place and move on.

- [ ] **Step 3: Commit**

```bash
git add lib/posthog.ts
git commit -m "refactor(posthog): expand trackShareSession payload, remove trackHistoryExported

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create `ShareCard.tsx` (presentational 1:1 card)

**Files:**
- Create: `components/share/ShareCard.tsx`

- [ ] **Step 1: Write the component**

Create `components/share/ShareCard.tsx` with this exact content:

```tsx
import { forwardRef, useMemo } from 'react';
import { View, Text } from 'react-native';
import { FastingSession } from '../../types';
import { PhaseRing } from '../ui/PhaseRing';
import { getCurrentPhase, TABULAR, Theme } from '../../constants/theme';

export const SHARE_CARD_SIZE = 360;
const RING_SIZE = 220;
const PADDING = 32;

interface ShareCardProps {
  session: FastingSession;
  waterMl?: number;
  theme: Theme;
  /** Override "now" for in-progress sessions (tests / stable capture). Defaults to Date.now(). */
  now?: number;
}

function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatEyebrow(session: FastingSession): string {
  const d = new Date(session.started_at);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const prefix = session.ended_at ? session.protocol : `In progress · ${session.protocol}`;
  return `${prefix} · ${date}`.toUpperCase();
}

/**
 * 1:1 square share card. Purely presentational — no side effects.
 * forwardRef so parent can capture this view with react-native-view-shot.
 */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { session, waterMl, theme, now },
  ref,
) {
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : (now ?? Date.now());
  const elapsedMs = endMs - new Date(session.started_at).getTime();
  const elapsedHours = elapsedMs / 3600000;
  const phase = useMemo(() => getCurrentPhase(elapsedHours), [elapsedHours]);
  const eyebrow = useMemo(() => formatEyebrow(session), [session]);
  const elapsedLabel = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: SHARE_CARD_SIZE,
        height: SHARE_CARD_SIZE,
        padding: PADDING,
        backgroundColor: theme.bg,
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          color: theme.textFaint,
        }}
      >
        {eyebrow}
      </Text>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <PhaseRing
            size={RING_SIZE}
            stroke={12}
            hours={Math.min(elapsedHours, 24)}
            target={session.target_hours}
            theme={theme}
            showTicks={false}
            animated={false}
          />
          <View
            style={{
              position: 'absolute',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 44,
                fontWeight: '700',
                letterSpacing: -1.5,
                color: theme.text,
                ...TABULAR,
              }}
            >
              {elapsedLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.primary, letterSpacing: -0.4 }}>
          {phase.name}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: theme.textMuted,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          {phase.description}
        </Text>
        {waterMl !== undefined && waterMl > 0 && (
          <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>
            💧 {(waterMl / 1000).toFixed(1)}L water
          </Text>
        )}
      </View>

      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          color: theme.textFaint,
          textAlign: 'center',
        }}
      >
        FASTLOG
      </Text>
    </View>
  );
});
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: the three errors from Task 2 remain; no new errors from `ShareCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/share/ShareCard.tsx
git commit -m "feat(share): add ShareCard presentational component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create `lib/captureShareCard.ts` helper

**Files:**
- Create: `lib/captureShareCard.ts`

- [ ] **Step 1: Write the helper**

Create `lib/captureShareCard.ts` with this exact content:

```ts
import { RefObject } from 'react';
import { View, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import { FastingSession } from '../types';
import { trackShareSession } from './posthog';

interface CaptureAndShareArgs {
  ref: RefObject<View>;
  session: FastingSession;
  source: 'history' | 'fast_complete';
}

/**
 * Capture the referenced ShareCard view as a PNG, then open the iOS share sheet.
 * Fires PostHog `share_session` and a success haptic on completion.
 */
export async function captureAndShare({ ref, session, source }: CaptureAndShareArgs): Promise<void> {
  if (!ref.current) {
    console.warn('[captureShareCard] missing ref');
    return;
  }

  const uri = await captureRef(ref.current, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const durationH = (endMs - new Date(session.started_at).getTime()) / 3600000;

  trackShareSession({
    source,
    protocol: session.protocol,
    completed: !!session.completed,
    duration_h: Math.round(durationH * 100) / 100,
  });

  try {
    await Share.share({ url: uri });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (err) {
    console.warn('[captureShareCard] share failed:', err);
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: the three existing errors from Task 2 remain; no new errors from `captureShareCard.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/captureShareCard.ts
git commit -m "feat(share): add captureShareCard helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create `ShareCardPreviewSheet.tsx`

**Files:**
- Create: `components/share/ShareCardPreviewSheet.tsx`

- [ ] **Step 1: Write the sheet**

Create `components/share/ShareCardPreviewSheet.tsx` with this exact content:

```tsx
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { FastingSession } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { ShareCard } from './ShareCard';
import { captureAndShare } from '../../lib/captureShareCard';

export interface ShareCardPreviewSheetRef {
  present: (args: PresentArgs) => void;
  dismiss: () => void;
}

interface PresentArgs {
  session: FastingSession;
  waterMl?: number;
  source: 'history' | 'fast_complete';
}

export const ShareCardPreviewSheet = forwardRef<ShareCardPreviewSheetRef, object>(
  function ShareCardPreviewSheet(_, ref) {
    const theme = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);
    const cardRef = useRef<View>(null);
    const [args, setArgs] = useState<PresentArgs | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        present: (a: PresentArgs) => {
          setArgs(a);
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
      [],
    );

    async function handleShare() {
      if (!args || isSharing) return;
      setIsSharing(true);
      try {
        await captureAndShare({ ref: cardRef, session: args.session, source: args.source });
      } finally {
        setIsSharing(false);
      }
    }

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['85%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.hairline, width: 40, height: 4 }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.2,
              color: theme.textFaint,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            Preview
          </Text>

          {args && (
            <View style={{ borderRadius: 20, overflow: 'hidden' }}>
              <ShareCard
                ref={cardRef}
                session={args.session}
                waterMl={args.waterMl}
                theme={theme}
              />
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={handleShare}
            disabled={isSharing || !args}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: 'center',
              alignSelf: 'stretch',
              marginTop: 16,
              opacity: isSharing ? 0.7 : 1,
            }}
          >
            {isSharing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Share</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            style={{ paddingVertical: 12, alignItems: 'center', alignSelf: 'stretch' }}
          >
            <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: '500' }}>Cancel</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: the three existing errors from Task 2 remain; no new errors from `ShareCardPreviewSheet.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/share/ShareCardPreviewSheet.tsx
git commit -m "feat(share): add ShareCardPreviewSheet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire sheet into `SessionDetailDrawer.tsx`

**Files:**
- Modify: `components/history/SessionDetailDrawer.tsx`

- [ ] **Step 1: Update imports**

In `components/history/SessionDetailDrawer.tsx`:

Remove this line:
```ts
import { shareSession } from '../../lib/shareSession';
```

Add these imports (after the existing `trackPaywallViewed, trackShareSession` import):
```ts
import { ShareCardPreviewSheet, ShareCardPreviewSheetRef } from '../share/ShareCardPreviewSheet';
```

- [ ] **Step 2: Add sheet ref inside the component**

Inside `SessionDetailDrawer`, just below the existing `const sheetRef = useRef<BottomSheetModal>(null);` line, add:

```ts
const shareSheetRef = useRef<ShareCardPreviewSheetRef>(null);
```

- [ ] **Step 3: Replace the Share Pressable body**

Find the Share `Pressable` (currently starting around line 337) and replace its `onPress` handler. The existing handler looks like:

```tsx
onPress={() => {
  if (!isPro) {
    trackPaywallViewed('share_session');
    router.push('/paywall');
    return;
  }
  trackShareSession();
  shareSession(session!, dayWaterMl > 0 ? dayWaterMl : undefined);
}}
```

Replace with:

```tsx
onPress={() => {
  if (!isPro) {
    trackPaywallViewed('share_session');
    router.push('/paywall');
    return;
  }
  shareSheetRef.current?.present({
    session: session!,
    waterMl: dayWaterMl > 0 ? dayWaterMl : undefined,
    source: 'history',
  });
}}
```

(`trackShareSession` is called inside `captureAndShare`, so remove the bare invocation here. The `trackShareSession` import is no longer used in this file — remove it from the import on line 17, leaving only `trackPaywallViewed`.)

- [ ] **Step 4: Render the sheet**

Before the final closing `</BottomSheetModal>`, add the `ShareCardPreviewSheet` as a sibling inside the same `BottomSheetScrollView`'s parent. Easiest placement: immediately after the closing `</BottomSheetModal>` tag of the drawer — add this outside the drawer but inside a wrapping fragment.

Change the component's outer return to wrap both modals:

```tsx
return (
  <>
    <BottomSheetModal
      ref={sheetRef}
      ... existing props and children ...
    </BottomSheetModal>
    <ShareCardPreviewSheet ref={shareSheetRef} />
  </>
);
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: errors in `app/(tabs)/history.tsx` and `app/fast-complete.tsx` remain; `SessionDetailDrawer.tsx` compiles cleanly.

- [ ] **Step 6: Commit**

```bash
git add components/history/SessionDetailDrawer.tsx
git commit -m "feat(history): wire ShareCardPreviewSheet into session drawer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire sheet into `app/fast-complete.tsx` (Pro-gated)

**Files:**
- Modify: `app/fast-complete.tsx`

- [ ] **Step 1: Update imports**

Remove:
```ts
import { trackShareSession } from '../lib/posthog';
```

Replace with:
```ts
import { trackPaywallViewed } from '../lib/posthog';
import { useRef } from 'react';
import { ShareCardPreviewSheet, ShareCardPreviewSheetRef } from '../components/share/ShareCardPreviewSheet';
```

Also remove `Share` from the `react-native` import line:
```ts
// Before:
import { View, Text, Pressable, ScrollView, Share } from 'react-native';
// After:
import { View, Text, Pressable, ScrollView } from 'react-native';
```

Add `useRef` to the existing `react` imports (and remove the duplicate import line added above once merged):
```ts
import { useEffect, useMemo, useRef, useState } from 'react';
```

Pull `isPro` from `useUserStore`. Below the existing `const profile = useUserStore(s => s.profile);` line, add:
```ts
const isPro = useUserStore(s => s.isPro);
```

And add the ref near the top of the component (near other `useRef`/`useState` hooks):
```ts
const shareSheetRef = useRef<ShareCardPreviewSheetRef>(null);
```

Also pull `todayTotalMl` which is already available from `useHydration()` — reuse it.

- [ ] **Step 2: Replace the "Share progress" Pressable**

Find the Pressable (currently lines 381-400) and replace the whole `<Pressable onPress={async () => {...}}>...</Pressable>` block with:

```tsx
<Pressable
  onPress={() => {
    if (!session) return;
    if (!isPro) {
      trackPaywallViewed('share_card');
      router.push('/paywall');
      return;
    }
    shareSheetRef.current?.present({
      session,
      waterMl: todayTotalMl > 0 ? todayTotalMl : undefined,
      source: 'fast_complete',
    });
  }}
  style={{ paddingVertical: 10, alignItems: 'center', marginTop: 4, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
>
  {!isPro && (
    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 }}>PRO</Text>
  )}
  <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textMuted }}>
    Share this fast
  </Text>
</Pressable>
```

- [ ] **Step 3: Render the sheet**

At the very end of the outer `<View>` (after the `</ScrollView>` closing tag and before the final `</View>`), add:

```tsx
<ShareCardPreviewSheet ref={shareSheetRef} />
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: only `app/(tabs)/history.tsx` errors remain; `fast-complete.tsx` compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add app/fast-complete.tsx
git commit -m "feat(fast-complete): Pro-gated share card replaces plain-text link

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Remove CSV export from `app/(tabs)/history.tsx`

**Files:**
- Modify: `app/(tabs)/history.tsx`

- [ ] **Step 1: Remove imports**

Remove these two import lines:

```ts
import { trackPaywallViewed, trackHistoryExported } from '../../lib/posthog';
import { exportHistoryCSV } from '../../lib/exportHistory';
```

Replace the first with (keeping `trackPaywallViewed` since it's still used elsewhere in the file):

```ts
import { trackPaywallViewed } from '../../lib/posthog';
```

- [ ] **Step 2: Delete `handleExport`**

Delete the `handleExport` function (lines ~246-255):

```ts
function handleExport() {
  if (!isPro) {
    trackPaywallViewed('export_history');
    router.push('/paywall');
    return;
  }
  if (allSessions.length > 0) {
    exportHistoryCSV(allSessions).then(() => trackHistoryExported());
  }
}
```

- [ ] **Step 3: Remove export icon from `ScreenHeader`**

In the JSX, replace:

```tsx
<ScreenHeader
  theme={theme}
  title="History"
  trailing={
    <CircleIcon theme={theme} size={36} onPress={handleExport}>
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path
          d="M7 2v7M4 6l3 3 3-3M3 11h8"
          stroke={theme.textMuted}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </CircleIcon>
  }
/>
```

With:

```tsx
<ScreenHeader theme={theme} title="History" />
```

- [ ] **Step 4: Remove "Export" inline link next to Recent Fasts**

Find this block (currently lines ~557-561):

```tsx
<Pressable onPress={handleExport}>
  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600', letterSpacing: -0.1 }}>
    Export
  </Text>
</Pressable>
```

Delete it entirely. The surrounding `<View>` (the flex row with "Recent Fasts" eyebrow) should keep the eyebrow only — it will collapse to a single Text on one side, which is fine visually.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/history.tsx
git commit -m "refactor(history): remove CSV export from header and recent fasts row

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Delete `lib/shareSession.ts` and `lib/exportHistory.ts`

**Files:**
- Delete: `lib/shareSession.ts`
- Delete: `lib/exportHistory.ts`

- [ ] **Step 1: Confirm there are no remaining references**

```bash
git grep -n "from '.*shareSession'" -- '*.ts' '*.tsx' ; git grep -n "from '.*exportHistory'" -- '*.ts' '*.tsx'
```

Expected: no output.

- [ ] **Step 2: Delete the files**

```bash
rm lib/shareSession.ts lib/exportHistory.ts
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add -A lib/
git commit -m "chore: delete legacy shareSession and exportHistory modules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Manual verification on iOS simulator

**Files:** none modified.

- [ ] **Step 1: Build and run on iOS simulator**

```bash
npx expo run:ios
```

Expected: app launches without native errors.

- [ ] **Step 2: Verify fast-complete share (Pro)**

Sign in as a Pro test user. Complete a fast (or use an existing one) so `fast-complete.tsx` appears. Confirm:
- Old "Share progress" muted link is gone
- New "Share this fast" link is present (no "PRO" badge for Pro users)
- Tap → preview sheet slides up
- `ShareCard` renders centered with `PhaseRing`, elapsed time, phase name + description, water line, "FASTLOG" watermark
- Tap "Share" → native iOS share sheet appears with PNG attachment
- Save image to Photos → confirm it is a ~1080×1080 square PNG with correct theme colors

- [ ] **Step 3: Verify fast-complete share (non-Pro)**

Sign out / flip to a free test user. Reach fast-complete. Confirm:
- "Share this fast" shows "PRO" badge
- Tap → routes to `/paywall` (no preview sheet opens)
- PostHog emits `paywall_viewed` with `source: 'share_card'`

- [ ] **Step 4: Verify history drawer share (Pro)**

Open History, tap a completed session. Tap "Share Session" in the drawer. Confirm:
- Preview sheet opens with the exact card for that session
- `waterMl` reflects that day's total (only shown when > 0)
- Share → iOS share sheet → Photos → correct PNG

- [ ] **Step 5: Verify history drawer share (non-Pro)**

As free user, open a completed session, tap Share Session. Confirm paywall opens; no preview sheet.

- [ ] **Step 6: Verify CSV export is gone**

- History header: no download icon in trailing slot
- Recent Fasts row: no "Export" link
- No references to `exportHistoryCSV` or `trackHistoryExported` anywhere:
  ```bash
  git grep -nE "exportHistoryCSV|trackHistoryExported|history_exported"
  ```
  Expected: no output.

- [ ] **Step 7: Verify dark mode**

Flip device to dark mode. Open history, open a session, tap Share. Preview card renders with dark tokens (walnut bg, light text). Captured PNG is dark.

- [ ] **Step 8: Verify in-progress fast**

Start a fast. From History, tap today's day cell → open the live session drawer. Tap Share. Confirm:
- Preview card eyebrow reads `IN PROGRESS · 16:8 · <date>`
- Elapsed label shows current running time
- No completion mark

- [ ] **Step 9: Verify no-water edge case**

Share a fast from a day with zero water logged. Confirm the water line is omitted entirely (no "💧 0.0L").

- [ ] **Step 10: Commit any verification-driven fixes**

If any manual check failed, fix in place, re-run the relevant checks, and commit with a focused message. If all checks pass, no commit needed — manual verification is done.

---

## Self-Review

- **Spec coverage:**
  - Rendering approach (`react-native-view-shot`) → Task 1
  - `ShareCard` with layout + ring + stats + watermark → Task 3
  - `captureShareCard.ts` helper → Task 4
  - `ShareCardPreviewSheet.tsx` → Task 5
  - Drawer wire-up → Task 6
  - Fast-complete Pro-gated wire-up → Task 7
  - CSV export removal → Task 8
  - `shareSession.ts` / `exportHistory.ts` deletion → Task 9
  - PostHog event payload expansion + `trackHistoryExported` removal → Task 2
  - Edge cases (in-progress, no water, dark mode) → Task 10 steps 7-9
- **Placeholders:** none. Every code block is complete.
- **Type consistency:** `ShareCardPreviewSheetRef.present({ session, waterMl?, source })` matches call sites in Tasks 6 and 7. `captureAndShare({ ref, session, source })` matches its usage inside the sheet. `trackShareSession({ source, protocol, completed, duration_h })` matches the helper definition in Task 2 and the only call in Task 4.
