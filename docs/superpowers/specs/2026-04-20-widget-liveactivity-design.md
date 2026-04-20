# Widget & Live Activity — Design Spec

_2026-04-20_

## Problem

The iOS home-screen widget renders blank and the Live Activity never appears when a fast starts. Both extensions are installed correctly (TestFlight build), but JS is never handing them data:

- **Widget blank.** `expo-widgets` exposes `Widget.updateSnapshot(props)` and `Widget.updateTimeline(...)` to push state into the widget extension. The current code instead calls `writeSharedState()` (writes to App Groups `UserDefaults` via `react-native-shared-group-preferences`) and a **non-existent** `reloadAllTimelines()` export. That call is caught by the `try/catch` in `lib/sharedState.ts` and silently no-ops. The widget extension therefore receives default/undefined props on every timeline resolve and renders empty.
- **Live Activity silent.** `lib/liveActivity.ts` recreates a `LiveActivityFactory` named `'FastingActivity'` with a **stub component** `() => ({ banner: null })`. This duplicates (and in practice bypasses) the real factory already exported from `widgets/FastingActivity.tsx`. Depending on how the two factories collide in the native bridge, `start()` either throws or starts an activity with no UI.

This spec covers both the wiring fix and a coherent visual redesign in the Amber Sunrise system.

## Goals

- Widget shows correct state the moment a fast starts, when it transitions phase, and on app foreground.
- Live Activity appears in the Dynamic Island and the lock-screen banner with correct content.
- Both render in the Amber Sunrise design system, matching the in-app hero ring aesthetic.
- Light + dark parity on the home-screen widget. Dynamic Island + banner stay on dark system surfaces (iOS convention).
- No new runtime dependencies — remove `react-native-shared-group-preferences` and the `sharedState.ts` bridge once `updateSnapshot` is the single source of truth.

## Non-goals

- No Android widget (project is iOS-only).
- No push-delivered Live Activity updates over APNs. All updates are local (`update()` calls from JS on phase transitions).
- No additional widget families (`systemLarge`, `accessory*`). Scope stays at `systemSmall` + `systemMedium`.
- No changes to the timer logic in `hooks/useFasting.ts` beyond what's needed to push widget/activity snapshots.

## Architecture

### Data flow — one direction, one source

```
useFasting (JS)          widgets/FastingWidget (SwiftUI-via-expo-widgets)
     │                                    ▲
     │  widget.updateSnapshot(state)      │
     ├───────────────────────────────────►│
     │
     │  factory.start(state)              widgets/FastingActivity
     │  activity.update(state)            (LiveActivity extension)
     │  activity.end('default')                       ▲
     └──────────────────────────────────────────────►│
```

All widget/activity state travels through `expo-widgets`' first-class APIs. No App Groups `UserDefaults` bridge, no shared preferences plugin, no secondary timeline file.

### Module responsibilities

- `widgets/FastingWidget.tsx` — declares the `Widget` factory and **also exports the instance**. SwiftUI layout only, no JS runtime code.
- `widgets/FastingActivity.tsx` — declares the `LiveActivityFactory` and **also exports the instance**. SwiftUI layout only.
- `lib/widget.ts` (new) — thin JS wrapper around `widgets/FastingWidget`'s factory: `pushWidgetSnapshot(state)` and `clearWidgetSnapshot()`. Handles iOS-only gate and swallows errors in Expo Go / non-native runtimes.
- `lib/liveActivity.ts` — rewritten to import the factory from `widgets/FastingActivity.tsx`. Keeps the same public API (`startLiveActivity`, `updateLiveActivity`, `endLiveActivity`, `restoreLiveActivity`, `hasLiveActivity`).
- `hooks/useFasting.ts` — replace `writeSharedState(...)` calls with `pushWidgetSnapshot(...)`. Push on fast start, phase transition, app foreground, and fast stop (cleared state).
- `lib/sharedState.ts` — **deleted**.
- `react-native-shared-group-preferences` — removed from `package.json`.

### Widget snapshot type

Collapse to a single state shape shared by widget + activity consumer paths:

```ts
// widgets/FastingWidget.tsx
export interface FastingState {
  isActive: boolean;
  startedAt: string | null;   // ISO8601
  targetHours: number;
  phase: string;              // matches constants/phases.ts name
  protocol: string;           // '16:8' | '18:6' | '24h' | 'custom'
}
```

We drop `elapsedHours` from the widget's props. The SwiftUI side derives elapsed locally via the native `Text(date:, style: .timer)` modifier and recomputes phase from `startedAt` on each timeline entry — that's already how the code uses it, so the field is dead weight.

The Live Activity keeps its richer shape (`FastingActivityState`: adds `phaseDescription`), since the expanded view shows the description inline.

### When JS schedules widget content

Two update paths coexist:

1. **On fast start** — call `widget.updateTimeline(entries)` with one entry per hour from `startedAt` to `startedAt + targetHours`, plus one entry at `targetHours` with the expected post-target phase ("Deep Fast"). iOS burns through these entries automatically; no further calls needed until state changes. This keeps the ring/percent fresh to within ~1h without any app wake-up.
2. **On state change — call `widget.updateSnapshot(state)`** (not the timeline variant). Triggers:
   - Phase transition (existing effect on `currentPhase.name` change)
   - App foreground (existing `AppState` `'active'` listener)
   - Fast stop — push `{ isActive: false, startedAt: null, targetHours: 0, phase: 'Fed State', protocol: <last protocol> }` so the widget flips to the inactive layout immediately.

Between the pre-scheduled hourly timeline entries and the event-driven snapshot pushes, the widget's ring/percent never drifts more than ~1h stale, and the visible timer numerals tick every minute natively via `Text date={..} dateStyle="timer"`.

### Live Activity refactor

```ts
// lib/liveActivity.ts (new shape)
import factory, { type FastingActivityState } from '../widgets/FastingActivity';

let activity: LiveActivity<FastingActivityState> | null = null;

export async function startLiveActivity(state) {
  if (Platform.OS !== 'ios' || isExpoGo) return;
  await endLiveActivity();
  try {
    activity = factory.start(state); // sync per expo-widgets types
  } catch (e) { console.error('[liveActivity] start failed:', e); activity = null; }
}

export async function updateLiveActivity(state) {
  if (!activity) return;
  try { await activity.update(state); } catch (e) { /* warn */ }
}

export async function endLiveActivity() {
  if (!activity) return;
  try { await activity.end('default'); } finally { activity = null; }
}

export async function restoreLiveActivity(state) {
  // On app cold start while a fast is still in progress, check factory.getInstances()
  // first — iOS may have preserved the prior activity across a restart.
  const existing = factory.getInstances()[0];
  if (existing) { activity = existing; await updateLiveActivity(state); return; }
  await startLiveActivity(state);
}

export function hasLiveActivity() { return activity !== null; }
```

Two behavioural changes worth noting:

- `factory.start(…)` is **synchronous** per the `expo-widgets` type definitions. Existing `await f.start(...)` was harmless but misleading — the new code drops the await.
- `restoreLiveActivity` now reads `factory.getInstances()` so we reattach to the existing activity instead of calling `start()` again (which iOS would silently reject or duplicate).

`updateLiveActivity` no longer needs the `currentFull` merge parameter — callers now pass the full state directly, and the factory component already handles every field.

## Visual design — Amber Sunrise

Source of truth: `constants/theme.ts`. Widget colour tokens live in a **local mirror** inside `widgets/FastingWidget.tsx` (the `'widget'` boundary can't import hooks). Mirror must be kept in sync; a comment at the top of the file flags this.

### Widget palette mirror

```ts
const WIDGET_COLORS = {
  light: {
    bg: '#FBF6EE', surface: '#FFFFFF', surface2: '#F5EEE2',
    text: '#2A1F14', textMuted: '#6B5A44', textFaint: '#A8957A',
    primary: '#C8621B', primarySoft: '#E89B5C', accent: '#D89B2B',
    trackEmpty: '#F0E3CA',
  },
  dark: {
    bg: '#17110A', surface: '#221A10', surface2: '#2B2115',
    text: '#FBF3E3', textMuted: '#C9B590', textFaint: '#7A6B54',
    primary: '#E89B5C', primarySoft: '#C8621B', accent: '#EDBC52',
    trackEmpty: '#2B2115',
  },
  phaseGradientStart: '#E6A86B',
  phaseGradientEnd:   '#C8621B',
};
```

The SwiftUI layout picks `WIDGET_COLORS[env.colorScheme]` at render time. `expo-widgets` exposes `env.colorScheme` via the `WidgetEnvironment` argument.

### Small widget — active

```
┌─────────────────────────┐
│  AUTOPHAGY ZONE         │   eyebrow 10/700/1.5px, color: accent
│                         │
│        ┌───┐            │   ring 84×84, stroke 6, trackEmpty underlay,
│        │9:24│           │   gradient overlay (phaseGradientStart→End),
│        │of16h│          │   dashOffset ← elapsed/target, rotate(-90)
│        └───┘            │
│                         │
│  59% · 16:8             │   caption 11/500, color: textMuted
└─────────────────────────┘
```

- Background: `bg`. A radial glow (`rgba(200,98,27,0.2)` → transparent, 60%) sits at the top-right corner, rendered as a semi-transparent layer behind content.
- Timer numerals inside the ring use SF Rounded 18/700, tabular-nums, letter-spacing −0.8. Center label "of {target}h" 9/500, colour: textMuted.
- Bottom row: `{percent}% · {protocol}`. Percent recomputed natively from elapsed.

### Small widget — inactive

```
┌─────────────────────────┐
│  READY                  │   eyebrow 10/700/1.5px, color: accent
│                         │
│        ┌ ─ ┐            │   dashed track only (stroke 6, dash 4/6),
│        │16h│            │   no gradient overlay
│        │prot│           │
│        └ ─ ┘            │   center: "16h" 22/700 primary, "protocol" 9/500
│                         │
│      [Tap to start]     │   pill: primary bg, white text, 10/600
└─────────────────────────┘
```

- Glow is softer (`rgba(216,155,43,0.2)` → transparent, 60%), centered behind the ring.
- Pill button is decorative — the tap target is the full widget via `widgetURL('fastlog://start')`.

### Medium widget — active

Layout: `HStack` — ring on the left (120×120), copy stack on the right.

- **Left:** 120pt phase ring, stroke 8, same gradient. Timer inside is 30/700 tabular, "of {target}h" 10/500 underneath.
- **Right:** eyebrow ("AUTOPHAGY ZONE" in accent), headline ("Cellular cleanup" 13/600 text), caption (`{percent}% · 16:8 protocol` in textMuted). Separator `hairline` 1px across the right-column. Below: small label "Ends at" 10/500 textFaint, then formatted time 14/600 text.

### Medium widget — inactive

- **Left:** 120pt dashed ring, center `16h` 28/700 primary + "protocol" 10/500.
- **Right:** eyebrow "FASTLOG", headline "Ready when you are" 15/600, caption `{protocol} · tap to start` in textMuted.
- Below caption: the "Tap to start" pill.

### Dynamic Island + lock-screen banner — "Ring Echo"

All dark-surface. Accent = `#D89B2B`, primary-gradient = `#E6A86B → #C8621B`.

**Compact leading (~22pt)**  Mini ring, stroke 2.5, 22×22 inside padding. Gradient stays full even in compact — the ring is the Dynamic Island personality marker.

**Compact trailing** Timer text, 14/600 tabular, white (`#F5F5F5`).

**Minimal** Same 22×22 mini ring, no text. Used when the user runs multiple activities and iOS collapses the pill.

**Expanded — `expandedLeading`** 72pt ring with timer (13/700 tabular) and "of {target}h" (8/500 textFaint-on-dark) stacked inside the ring.

**Expanded — `expandedTrailing`** Stack, right-aligned. Eyebrow `{phase}` in accent 12/700 uppercase. Below it: `{protocol} fast` in 11/500 muted.

**Expanded — `expandedBottom`** Caption: `{phaseDescription} · ends {HH:mm}`. 11/500 `#A8957A`. Padding: leading 16 / trailing 16 / bottom 8.

**Banner**

```
┌────────────────────────────────────────┐
│ ┌────┐  AUTOPHAGY ZONE                 │
│ │ ◐  │  9:24 / 16h                     │
│ └────┘  Cellular cleanup · ends 6:45PM │
└────────────────────────────────────────┘
```

- Icon badge 44×44, 14px corner radius, linear-gradient `#C8621B → #6B2A12`, holds a 26pt mini ring (white 2.5-stroke with transparent-white track).
- Timer 22/700 tabular, `/ 16h` suffix 14/400 textMuted.
- Caption 11/500 textMuted.

### Tap targets

- Widget active: `widgetURL('fastlog://timer')`
- Widget inactive: `widgetURL('fastlog://start')`
- Live Activity: `factory.start(state, 'fastlog://timer')` — the second arg to `start()` is the deep-link URL.

## Testing

- **Unit-level:** n/a — widget/activity layouts are declarative SwiftUI-via-expo-widgets with no branching testable outside the simulator.
- **Manual verification matrix (dev build on device, iOS 17+):**
  1. Start a 16:8 fast → small widget fills ring, shows "FED STATE" or next phase within 30s.
  2. Background the app, wait 4h 1m (or fake-forward device clock) → widget phase transitions to "EARLY FASTING" without needing foreground.
  3. Foreground the app → no visible reload jank, phase/percent correct.
  4. Dynamic Island compact leading shows mini ring; long-press expands to 72pt ring.
  5. Lock-screen banner appears under the clock; badge + timer visible.
  6. Stop fast → widget flips to inactive within 1s; Live Activity dismisses.
  7. Light-mode then dark-mode switch on home screen → widget palette swaps correctly.
  8. Kill the app, relaunch with an active fast → Live Activity reattaches (no duplicate); widget continues.
- **Acceptance:** `console.error('[liveActivity] start failed:', …)` no longer fires during start (view via Console.app over USB on TestFlight build).

## Migration notes

- `lib/sharedState.ts` — delete.
- `react-native-shared-group-preferences` — remove from `package.json` and `package-lock.json`.
- `app.config.ts` — keep `groupIdentifier: 'group.com.fastlog.app'` on the `expo-widgets` plugin config (still needed for the native widget bundle entitlements), but App Groups is no longer touched from JS.
- Existing `hooks/useFasting.ts` imports of `writeSharedState` — replace with `pushWidgetSnapshot`.
- Native prebuild must be re-run: `npx expo prebuild --clean` before the next TestFlight build, so the regenerated widget extension picks up the prop-shape change (`elapsedHours` removed).

## Risks & open questions

- **Palette drift.** The widget keeps a duplicate `WIDGET_COLORS` table because the `'widget'` boundary can't import `useTheme`. Acceptable; comment at the top of `widgets/FastingWidget.tsx` warns the reader. Spec-level: if `constants/theme.ts` gets an updated palette in the future, both files change together.
- **Existing live activities on upgrade.** Users with an in-flight fast before this change ship will see the old (broken) activity persist until app foreground. `restoreLiveActivity`'s new `getInstances()` lookup reattaches cleanly; if that fails, `endLiveActivity()` + `start()` still produces a correct activity. No data loss risk.
- **Widget "percent" freshness.** Ring/percent staleness is bounded by the hourly timeline entries pre-scheduled on fast start. Worst case is ~1h drift if the user neither opens the app nor hits a phase transition in the intervening hour — tolerable. Timer digits stay live-ticking via native `Text date={..} dateStyle="timer"`.

## Out of scope

- Interactive widgets (App Intents for "Start fast" button) — SwiftUI supports it on iOS 17+, but the current product decision keeps the tap target full-widget → open app. Revisit later.
- Redesign of the Timer tab deep-link handler. `app/_layout.tsx` already parses `fastlog://` — no changes needed if the existing handler routes `start` and `timer` to the same screen.
- Large-family widget (`systemLarge`). Not yet supported.
