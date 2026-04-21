# FastLog — Project Intelligence

## What this project is
A React Native (Expo) intermittent fasting + hydration tracker with a warm, premium "Amber Sunrise" visual system.
Freemium model: free timer + water + basic notifications; Pro unlocks history, streaks, custom protocols, scheduled fasts, share/export.
Target: iOS App Store. Light + dark mode parity.

## Stack
- **Frontend**: Expo SDK 55+, React Native 0.83, React 19, TypeScript strict, NativeWind 4 (Tailwind for RN) + inline theme tokens
- **Routing**: Expo Router v3 (file-based, app/ directory), custom glass-pill TabBar
- **Backend**: Supabase (auth, Postgres + RLS)
- **Payments**: RevenueCat (iOS). Entitlement id: `FastBuddy Pro`. Packages: `monthly`, `yearly`.
- **Notifications**: Expo Push + scheduled local (phase transitions, hydration, completion)
- **Analytics**: PostHog React Native
- **State**: Zustand (persisted via AsyncStorage), React Query for server data
- **SVG**: `react-native-svg` — all rings, glows, icons are drawn, no bitmaps
- **Glass blur**: `expo-blur` for the floating TabBar and notification preview

## Project structure
```
/
├── app/
│   ├── (auth)/                 # Unauthenticated stack
│   │   ├── welcome.tsx         # 3 swipeable intro slides
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                 # Authenticated tabs — Timer / Water / History / Profile
│   │   ├── _layout.tsx         # expo-router Tabs + GlassTabBar
│   │   ├── index.tsx           # Timer
│   │   ├── water.tsx
│   │   ├── history.tsx
│   │   └── profile.tsx
│   ├── onboarding/             # 3-step first-run flow
│   │   ├── protocol.tsx
│   │   ├── goal.tsx
│   │   └── notifications.tsx   # permissions + pref toggles
│   ├── fast-complete.tsx       # Modal celebration after completing a fast
│   ├── paywall.tsx             # Modal Pro upgrade
│   └── _layout.tsx             # Auth gate + deep links + push token
├── components/
│   ├── ui/                     # Design-system primitives (single source of truth)
│   │   ├── PhaseRing.tsx       # 6-segment hero ring
│   │   ├── WaterRing.tsx       # Water fill + static sine waves
│   │   ├── AmbientGlow.tsx     # SVG radial gradient orb
│   │   ├── TabBar.tsx          # Glass pill tab bar
│   │   ├── PrimaryButton.tsx
│   │   ├── Card.tsx
│   │   ├── PillRow.tsx
│   │   ├── CircleIcon.tsx
│   │   ├── ScreenHeader.tsx
│   │   ├── Toggle.tsx
│   │   ├── Field.tsx
│   │   ├── SocialButton.tsx
│   │   └── index.ts
│   ├── history/                # Calendar / card / detail drawer
│   ├── water/                  # Custom amount sheet
│   └── profile/                # FastScheduleCard (legacy — profile inlines schedule toggle)
├── constants/
│   ├── theme.ts                # Amber palette (light + dark), PHASES, radii, shadows — SOURCE OF TRUTH
│   ├── phases.ts               # Legacy re-export of PHASES for existing callers
│   ├── protocols.ts
│   ├── hydration.ts
│   └── styles.ts               # Legacy shadow helpers — prefer theme.ts helpers in new code
├── hooks/
│   ├── useTheme.ts             # Resolves Amber light/dark from system color scheme
│   ├── useFasting.ts           # Timer + notification orchestration
│   ├── useHydration.ts
│   ├── useSubscription.ts      # RevenueCat → userStore.isPro
│   └── useDailyHydration.ts
├── lib/
│   ├── supabase.ts
│   ├── revenuecat.ts
│   ├── notifications.ts
│   ├── liveActivity.ts
│   ├── sharedState.ts          # App Groups bridge for widgets
│   ├── auth.ts                 # signInWithApple/Email, resetPassword, signUpWithEmail
│   ├── exportHistory.ts
│   └── posthog.ts
├── stores/
│   ├── fastingStore.ts
│   ├── userStore.ts            # profile + isPro + hasSeenIntro + notificationPrefs + fastSchedule
│   └── hydrationStore.ts
├── supabase/migrations/        # 001 initial, 002 hydration, 003 constraints
├── widgets/                    # iOS Home Screen Widget + Live Activity
│   ├── FastingWidget.tsx
│   └── FastingActivity.tsx
└── types/index.ts              # Profile, FastingSession, HydrationLog, FastingProtocol, FastingGoal
```

## Database schema (Supabase)

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  preferred_protocol text default '16:8' check (preferred_protocol in ('16:8','18:6','24h','custom')),
  daily_water_goal_ml int default 2000,
  push_token text,
  goal text,                             -- optional: weight | energy | longevity | metabolic
  created_at timestamptz default now()
);

create table fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  protocol text not null,
  target_hours int not null check (target_hours > 0 and target_hours <= 72),
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references fasting_sessions(id) on delete set null,
  amount_ml int not null check (amount_ml > 0),
  logged_at timestamptz default now()
);
```
RLS: users can only read/write their own rows. A trigger auto-creates a profile row on `auth.users` insert.

> The legacy `checkins` table and `coach_personality` column from the original build remain in prior migrations but are no longer referenced by the app. The `generate-checkin` / `weekly-insight` Edge Functions have been removed.

## Fasting phases
| Range | Name | Description |
|---|---|---|
| 0–4h | Fed State | Body still processing last meal |
| 4–8h | Early Fasting | Insulin dropping |
| 8–12h | Fat Burning Begins | Glycogen depleting |
| 12–16h | Fat Burning Peak | Ketosis starting |
| 16–18h | Autophagy Zone | Cellular cleanup |
| 18h+ | Deep Fast | Maximum benefits |

## Fasting protocols
- `16:8` — default
- `18:6`
- `24h` (OMAD)
- `custom` — 8–72h, **Pro-only**

## Paywall rules
Pro unlocks:
- Full history (free: blurred preview of 3 most recent)
- Custom protocols
- Scheduled fasts
- Share & export

Free always gets: full Timer, Water tracking, basic notifications.
Always read Pro status from RevenueCat (`FastBuddy Pro` entitlement); never persist to Supabase.

## Notification preferences
`userStore.notificationPrefs` controls scheduling on fast start:
- `phaseTransitions` — encouraging message when entering each new phase
- `hydration` — every 2 hours during the fasting window
- `halfway` — quiet midpoint check-in
- `complete` — celebration at target end time

Values are set via onboarding step 3 and adjustable from Profile.

## RevenueCat
- Entitlement: `FastBuddy Pro`
- Packages: `monthly`, `yearly`
- `lib/revenuecat.ts` is iOS-only (lazy-require'd)

## Design system — Amber Sunrise

**Source of truth:** `constants/theme.ts`. Ported verbatim from `.claude/design/tokens.jsx`. Supports light + dark.

### Light mode tokens
| Token | Value |
|---|---|
| `bg` | `#FBF6EE` (warm cream) |
| `surface` | `#FFFFFF` |
| `surface2` | `#F5EEE2` |
| `text` | `#2A1F14` (espresso) |
| `textMuted` | `#6B5A44` |
| `textFaint` | `#A8957A` |
| `hairline` | `rgba(42,31,20,0.08)` |
| `primary` | `#C8621B` (burnt amber) |
| `primarySoft` | `#E89B5C` |
| `accent` | `#D89B2B` (gold) |
| `water` | `#5B9BB8` |
| `waterSoft` | `#A8CCDA` |
| `success` | `#5D8A6B` |
| `danger` | `#B15548` |

### Phase spectrum (fed → deep fast)
`#E8C89A · #E6A86B · #D88845 · #C8621B · #A04418 · #6B2A12`

Dark mode inverts to a warm walnut background (`#17110A`) with the phase spectrum shifted lighter so it glows.

### Radii
`8 · 14 · 18 · 22 · 30 · pill(999)` — buttons use 18, cards use 20.

### Spacing (4pt base)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`

### Shadows
- Card (light): `0 1px 2px rgba(42,31,20,.04), 0 4px 16px rgba(42,31,20,.05)` — helper: `cardShadow(theme)`
- Primary button: tinted `{color}55` — helper: `buttonShadow(color)`
- Elevated card (plan / fast-complete): `{color}22` — helper: `elevatedShadow(color)`

### Typography (SF Pro Rounded, system default)
| Role | Size / Weight / Tracking |
|---|---|
| Timer display | 52 / 300 / -2, `tabular-nums` |
| Title large | 34 / 700 / -0.8 |
| Title 2 | 28 / 700 / -0.8 |
| Headline | 19 / 600 / -0.3 |
| Body | 15 / 500 / -0.2 |
| Caption | 12 / 500 / 0 |
| Eyebrow | 11 / 700 / 1–2, UPPERCASE |

All numeric displays use `TABULAR` (`fontVariant: ['tabular-nums']`).

### Motion
- Phase ring fill: `stroke-dasharray` 800ms ease on elapsed change
- Progress head: 2s infinite pulse (`r−2 → r → r−2`)
- Ambient orb: 1.2s ease color crossfade on phase change
- Water ring: **no** animation on fill or waves
- Toggle: 200ms
- Pager dots: 300ms width `6 → 22`
- Primary button press: scale 0.97, 120ms

## Code conventions
- TypeScript strict, no `any`.
- Theme-aware colors come from `useTheme()` and are applied inline (`style={{ backgroundColor: theme.bg }}`). NativeWind handles layout/typography classes that don't depend on theme.
- All SVG drawn with `react-native-svg`. Phase ring, water ring, ambient glow, social-button glyphs, and all tab/nav icons are SVG.
- Timer is local-first — derive elapsed from `started_at` timestamp, never a counter; Supabase writes happen in the background.
- All Supabase calls go through `lib/supabase.ts`.
- Zustand stores persist via `AsyncStorage` middleware. `isPro` is never persisted — always re-read from RevenueCat.
- Use React Query for server data with typed query keys (`['fasting_sessions', userId]`, `['daily_hydration_totals']`).
- PostHog event on every meaningful action (`fast_started`, `fast_completed`, `fast_abandoned`, `paywall_viewed`, `pro_purchased`, `water_logged`, `water_goal_reached`, `protocol_changed`, `share_session`, `history_exported`).
- Copy tone is **warm, not pushy**: "You're in deep fat-burn", "Beautifully done", "Kind, not pushy". No streak-pressure language, no red alerts for inactivity.

## Environment variables (`.env`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_POSTHOG_KEY=
```

## What NOT to do
- Don't store subscription state in Supabase — always read from RevenueCat.
- Don't block the timer UI with a network request — timer is local-first.
- Don't show the paywall aggressively on first launch — contextual only (tapping locked features, first completed fast).
- Don't use `StyleSheet.create` — inline style + theme tokens for colors, NativeWind for layout.
- Don't add red alarm copy or streak-pressure nudges — it breaks the Amber Sunrise brand.
- Don't skip `TABULAR` on numeric displays — it's what makes the app feel premium.
- Don't hardcode theme colors in widgets or Live Activities — keep their COLORS constant in sync with `constants/theme.ts`.
