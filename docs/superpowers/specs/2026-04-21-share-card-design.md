# Share Card — Design Spec

**Date:** 2026-04-21
**Status:** Approved, ready for implementation plan
**Owner:** Denis

## Problem

The current sharing/export surface is underused and off-brand:

- `lib/shareSession.ts` dumps a 5-line plain-text message to the iOS share sheet. Utilitarian, unappealing, nobody shares it.
- `lib/exportHistory.ts` generates a CSV and drops it into the share sheet as `message`. No clear user value; CSV-over-message is awkward on iOS.
- `app/fast-complete.tsx` has a free plain-text "Share progress" link that bypasses Pro and produces the same low-quality output.

Result: "Share" exists but produces nothing worth sharing. Export exists but nobody exports.

## Goal

Replace the text-based share + CSV export with **one** premium feature: a beautiful 1:1 square image card centered on the existing `PhaseRing`, Pro-gated, shareable via the iOS share sheet (Messages, Photos, IG Stories, etc.).

## Scope

### What ships

- A new 1:1 square image card rendered from live RN views using `react-native-view-shot`.
- A preview bottom sheet where the user reviews the exact card before sharing.
- Two trigger points, both Pro-gated:
  - **Session Detail Drawer** (history) — replaces current text-share icon.
  - **Fast Complete modal** — replaces current free plain-text "Share progress" link.

### What gets killed

- `lib/exportHistory.ts` — deleted.
- CSV export icon in `app/(tabs)/history.tsx` header — removed, including `handleExport` and the `ScreenHeader` trailing slot.
- `trackHistoryExported` PostHog event — removed.
- `lib/shareSession.ts` (plain-text builder) — deleted.
- Fast Complete modal's free plain-text "Share progress" `Pressable` — replaced by Pro-gated "Share this fast" button opening the sheet.

### Non-goals (explicit YAGNI)

- No IG Stories deep-link integration — iOS share sheet handles it.
- No branded frame/filter variants — one card, one layout.
- No web-hosted share links — PNG only.
- No history-wide "year in review" card — single session only.
- No Android support work — iOS-first as per project target.

## Rendering approach

**Chosen:** `react-native-view-shot` (`captureRef`) over the existing RN view tree.

**Why:** Reuses the exact `PhaseRing` SVG, theme tokens, fonts, and layout system already on screen. WYSIWYG — the user sees the real card, taps Share, same pixels become the PNG. Small native dep (~30KB), Expo-compatible, no config plugin needed, offline.

**Alternatives considered and rejected:**

| Option | Verdict | Reason |
|---|---|---|
| `@shopify/react-native-skia` canvas | ✗ | Large native dep, would require reimplementing PhaseRing / phase logic / theme in Skia |
| Server-side render (Supabase Edge + satori) | ✗ | Network roundtrip, fragile, overkill for a sharing feature |

**Rendering trick:** the card inside the preview sheet IS the capture target. No off-screen rendering needed — preview and source are the same ref.

## Card layout

1:1 square. Source at 360pt (canvas), rasterized at device scale so output is ~1080×1080px @3x. Background uses `theme.bg` (follows user's current light/dark mode).

```
┌─────────────────────────────────┐
│  16:8 · Apr 21                  │  ← eyebrow, 11pt, textFaint, UPPERCASE
│                                 │
│                                 │
│         ┌─────────┐             │
│         │  ring   │             │  ← PhaseRing ~220pt, phase color
│         │ 16:42   │             │  ← elapsed, 44pt, TABULAR bold
│         │         │             │
│         └─────────┘             │
│                                 │
│       Autophagy Zone            │  ← phase.name, 22pt, theme.primary
│       Cellular cleanup          │  ← phase.description, 13pt, textMuted
│                                 │
│       💧 1.8L water             │  ← optional, 13pt, textMuted
│                                 │
│       FastLog                   │  ← watermark, 11pt eyebrow, textFaint
└─────────────────────────────────┘
```

**Padding:** 32pt inside the square.
**Ring:** reuses existing `components/ui/PhaseRing.tsx`, sized ~220pt, colored from the phase spectrum in `constants/theme.ts`.
**Typography:** SF Pro Rounded (system). Numeric displays use `TABULAR` (`fontVariant: ['tabular-nums']`) per project convention.
**Theme:** renders in the user's current mode — shared image reflects light or dark.

## UX flow

Identical from both triggers:

1. User taps "Share this fast" button (Pro-gated; non-Pro → `router.push('/paywall')` with `trackPaywallViewed('share_card')`).
2. `ShareCardPreviewSheet` opens as `BottomSheetModal` at ~85% snap point. Renders the exact card inside, with a primary `Share` CTA and a small `Cancel` / dismiss affordance.
3. On Share tap: `captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' })` → PNG URI in app cache.
4. `Share.share({ url: uri })` on iOS → native share sheet (Messages, Photos, IG Stories, etc.).
5. Light haptic (`Haptics.notificationAsync(Success)`) on successful dispatch.
6. PostHog `share_session` event with `{ source: 'history' | 'fast_complete', protocol, completed, duration_h }`.
7. Sheet stays open so user can re-share to another destination; dismiss on backdrop tap or Cancel.

## Code organization

### New files

- **`components/share/ShareCard.tsx`**
  - Pure presentational 1:1 card. `forwardRef<View>` so parent can capture it.
  - Props: `{ session: FastingSession; waterMl?: number; theme: Theme }`.
  - No side effects, no hooks beyond derived values (phase, elapsed, formatted date).
  - Uses existing `PhaseRing` from `components/ui`.

- **`components/share/ShareCardPreviewSheet.tsx`**
  - `BottomSheetModal` wrapper. Owns the capture ref and the capture-then-share flow.
  - Props: `{ session, waterMl?, source: 'history' | 'fast_complete' }` plus modal control.
  - Renders `ShareCard` + Share / Cancel actions.

- **`lib/captureShareCard.ts`**
  - Thin helper: `captureAndShare(ref, meta) → Promise<void>`.
  - Calls `captureRef`, then `Share.share({ url })`, then fires PostHog + haptic.
  - Keeps side effects out of the component.

### Modified files

- **`components/history/SessionDetailDrawer.tsx`** — share icon handler opens `ShareCardPreviewSheet` instead of calling `shareSession()`.
- **`app/fast-complete.tsx`** — remove free plain-text `Pressable`; add Pro-gated "Share this fast" button opening the sheet. Non-Pro → paywall.
- **`app/(tabs)/history.tsx`** — remove CSV export icon from `ScreenHeader` trailing slot and `handleExport`.
- **`lib/posthog.ts`** — remove `trackHistoryExported`. Keep `trackShareSession`; update its type to include `source` + `protocol` + `completed` + `duration_h`.

### Deleted files

- `lib/shareSession.ts`
- `lib/exportHistory.ts`

### Dependencies

- **Add:** `react-native-view-shot` (~30KB, Expo-compatible, no config plugin).

## Edge cases

- **In-progress fast** → elapsed shows current running time; no completion mark; eyebrow reads "In progress · 16:8".
- **Incomplete fast (ended early)** → shows actual duration, no celebration mark.
- **No water logged** → water line omitted entirely (no "0L").
- **Custom 48h+ fast** → ring caps visually at 100%; elapsed label reads e.g. "48:12".
- **Dark mode** → card renders with dark tokens; shared image reflects user's mode.

## Risks

- **Font rendering under `captureRef`.** In practice, SF Pro Rounded + `tabular-nums` rasterize correctly on iOS. If weights or digits look off in the PNG, fallback is to set `fontWeight` and `fontVariant` explicitly on the captured text nodes rather than relying on inherited styles.
- **Preview sheet height on small devices.** If the 1:1 card + Share button exceed ~85% sheet height on an iPhone SE class device, reduce ring to ~200pt or drop padding to 24pt — decide during implementation based on real measurements.

## Analytics

Keep: `share_session` (event name unchanged; payload upgraded as above).
Remove: `history_exported`.

## Test plan

- Share from Session Detail Drawer (Pro) → preview renders → tap Share → PNG appears in iOS share sheet → save to Photos → verify 1080×1080 image with correct phase color, elapsed, phase name, protocol + date, optional water line, FastLog watermark.
- Share from Fast Complete (Pro) → same path, `source: 'fast_complete'` in PostHog event.
- Non-Pro user taps either trigger → paywall appears; no preview sheet.
- Dark mode → shared image renders dark tokens.
- In-progress fast from drawer → eyebrow reads "In progress"; no completion mark.
- Fast with no water → no water line in card.
- `lib/shareSession.ts`, `lib/exportHistory.ts` removed; no references remain (`git grep shareSession`, `git grep exportHistoryCSV` empty).
- CSV export icon gone from history header.
