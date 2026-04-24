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
- **Notifications**: Expo Push. Phase/halfway/water/complete notifications are **server-scheduled** (Postgres `scheduled_pushes` + `pg_cron` → Edge Function → Expo API) so every signed-in device gets the same pings. Only the one-shot "fast started" confirmation is scheduled locally.
- **Multi-device sync**: Supabase **Realtime** (`postgres_changes` channel on `fasting_sessions` + `hydration_logs`) drives instant cross-device sync while foregrounded. Edge Function fan-out via Expo push wakes backgrounded devices. See "Multi-device sync" section.
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
│   ├── notifications.ts        # Only start-notification + registerForPushNotifications remain — server owns the rest
│   ├── liveActivity.ts
│   ├── widget.ts               # App Groups bridge for widgets / snapshot pushes
│   ├── auth.ts                 # signInWithApple/Email/Google, resetPassword, signUpWithEmail, signOut
│   ├── deviceId.ts             # Stable per-install UUID stored in AsyncStorage
│   ├── deviceTokens.ts         # register/unregister push tokens per (user, device)
│   ├── sessionAdoption.ts      # applyActiveSession — shared fresh-start + adopt bring-up
│   ├── endFast.ts              # endActiveFast + syncWithRemote + pendingEnd outbox flush
│   ├── realtime.ts             # Supabase Realtime subscription (foreground instant sync)
│   ├── hydrationSync.ts        # syncHydrationWithRemote — fetch-on-open catchup
│   ├── fastScheduler.ts        # Recurring "time to start your fast" reminder (local only)
│   ├── captureShareCard.ts
│   ├── scheduleFormat.ts
│   ├── validateEnv.ts
│   └── posthog.ts
├── stores/
│   ├── fastingStore.ts         # activeFast + scheduledNotificationIds + pendingEnd outbox
│   ├── userStore.ts            # profile + isPro + hasSeenIntro + notificationPrefs + fastSchedule
│   └── hydrationStore.ts       # todayLogs + applyRemoteLog/removeLogById for Realtime merges
├── supabase/
│   ├── migrations/             # 001–011 — see Database schema section below
│   └── functions/              # Deno Edge Functions (see below)
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

-- Added later — multi-device sync plumbing
create table device_tokens (...)    -- one row per (user_id, device_id). push_token lives here.
create table scheduled_pushes (...) -- seeded by seed_scheduled_pushes trigger on fast INSERT.
create table push_tickets (...)     -- Expo ticket ledger reaped by reap-push-receipts.
alter table profiles
  add column notification_prefs jsonb default '{"phaseTransitions":true,"hydration":true,"halfway":true,"complete":true}';
```

**Triggers (migrations 006–010):**
- `fasting_session_inserted` / `fasting_session_updated` → POST to `notify-fast-event` (visible cross-device push on start / early end).
- `seed_scheduled_pushes` → on fast INSERT, seeds `scheduled_pushes` honoring the user's `notification_prefs`.
- `reap_scheduled_pushes_on_end` → on UPDATE with `ended_at` transition, deletes future scheduled rows.
- `pg_cron` `dispatch-scheduled-pushes` every minute → POSTs to `dispatch-scheduled-pushes` Edge Function. No-ops if `edge_url` Vault secret is unset (local dev is silent).
- Partial unique index `fasting_sessions_one_active_per_user` on `(user_id) WHERE ended_at IS NULL` enforces one active fast per user. Client catches `23505` and adopts.

**RLS:** users read/write only their own rows on `profiles`, `fasting_sessions`, `hydration_logs`, `device_tokens`. `scheduled_pushes` + `push_tickets` are service-role only.

**Vault secrets** (seeded in 006, reused by 009/010): `edge_url` (base Edge Function URL), `webhook_secret` (shared secret; also `supabase secrets set WEBHOOK_SECRET=...` for the function env). Migration 011 dropped the legacy `checkins` table.

## Edge Functions
Three Deno functions in `supabase/functions/`:
- `notify-fast-event` — triggered by fast INSERT/UPDATE. Fans out to other devices via Expo push. Originator-skip via `last_modified_by_device`.
- `dispatch-scheduled-pushes` — pg_cron worker. Fetches due `scheduled_pushes` rows, **deletes them first** (prevents duplicate-send on slow minutes), then POSTs to Expo. Persist `tickets` into `push_tickets`.
- `reap-push-receipts` — pg_cron worker. Pulls tickets ≥15min old, calls Expo `getReceipts`, deletes `DeviceNotRegistered` tokens + processed tickets.

All three authenticate via `x-webhook-secret` header.

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
Stored as `profiles.notification_prefs` (jsonb) in the DB; mirrored into `userStore.notificationPrefs` (AsyncStorage) for fast UI reads. `setNotificationPrefs` fire-and-forgets the update to `profiles` so the server-side `seed_scheduled_pushes` trigger honors the latest toggle state.

Four toggles:
- `phaseTransitions` — encouraging message when entering each new phase
- `hydration` — every 2 hours during the fasting window
- `halfway` — quiet midpoint check-in
- `complete` — celebration at target end time

Values are set via onboarding step 3 and adjustable from Profile. On sign-in on a fresh device, `_layout.tsx` hydrates `userStore.notificationPrefs` from the DB so toggles follow the user across installs.

## Multi-device sync architecture
Goal: starting a fast on one device lights up timer/widget/LA on every other signed-in device, and every device receives the same notifications regardless of which one started it.

**Transports:**
| State | Transport | Latency |
|---|---|---|
| Both devices foreground | Supabase Realtime WebSocket (`postgres_changes` on `fasting_sessions` + `hydration_logs`, filtered by `user_id`) | <1s |
| Other device backgrounded | `notify-fast-event` + `dispatch-scheduled-pushes` → Expo push | ~1–60s |
| Reconnect / cold launch | `syncWithRemote()` + `syncHydrationWithRemote()` on foreground | seconds |

**Ownership:**
- **Server** owns phase/halfway/water/complete notification *timing* via `scheduled_pushes` + pg_cron. Client never schedules these locally.
- **Client** owns: the one-shot "fast started" local confirmation, the recurring `fastScheduler` "time to start your fast" reminder, and foreground Realtime subscription (started/stopped on AppState).

**Idempotency / dedup:**
- `applyActiveSession({ isFreshStart: false })` is idempotent when `store.activeFast?.sessionId === session.sessionId`.
- Fasting Realtime handlers filter own-device echoes via `last_modified_by_device === getDeviceId()`.
- `hydrationStore.applyRemoteLog` dedups by id and guards today-only — originator's own echo is a no-op.
- Dispatcher **deletes rows before sending** to Expo — accepts push-drop on Expo failure (pushes are best-effort) in exchange for zero duplicate sends when a cron run runs longer than its 60s slot.

**Originator skip:** every write stamps `last_modified_by_device = getDeviceId()`. `notify-fast-event` validates the claim against `device_tokens` then excludes that token from fan-out so the originator doesn't get a push for its own action.

**Durable end-write outbox:** `stopFast` persists `pendingEnd` in `fastingStore` before retrying the UPDATE up to 3× with backoff. `flushPendingEnd` runs before `syncWithRemote` and awaits Zustand rehydration first (prevents timer-resurrection on cold launch).

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

## Bundle identifiers
- **iOS app:** `com.fastlog.app`
- **iOS widget extension:** `com.fastlog.app.widgets`
- **iOS App Group:** `group.com.fastlog.app`
- **Android package:** `com.vectolis.fastlog` — different from iOS because the Play Store listing was registered under Vectolis. **Don't change this back to `com.fastlog.app`** — Google Play will reject any upload whose package doesn't match the listing.

## Android local build
Signing keystore lives at `~/keystores/fastlog/upload.jks` (outside the repo). `credentials.json` at the repo root points to it — gitignored, never commit. `plugins/withEasBuildGradle` wires `credentials.json` into `android/app/eas-build.gradle` on every `expo prebuild`, matching EAS cloud-build signing.

**Prereqs:** JDK **17** (not 21 — gradle/AGP breaks). Android SDK at `~/Library/Android/sdk`.

```
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH
```

**Build commands** (defined in `package.json`):
- `npm run android:prebuild` — regenerates `android/` from `app.config.ts`
- `npm run android:apk` — prebuild + signed APK → `android/app/build/outputs/apk/release/app-release.apk`
- `npm run android:aab` — prebuild + signed AAB → `android/app/build/outputs/bundle/release/app-release.aab`

See `README.md` for full setup + troubleshooting.

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
- **Don't schedule phase/halfway/water/complete notifications locally** — those are server-owned (`scheduled_pushes`). The only local schedule left is the one-shot `scheduleStartNotification` on fresh start and the recurring `fastScheduler` reminder.
- **Don't skip stamping `last_modified_by_device`** on fasting_sessions / hydration_logs writes. It's how originator-skip + Realtime echo-dedup work.
- **Don't write to `profiles.push_token`** — that column is legacy. Push tokens live in `device_tokens` keyed by `(user_id, device_id)`.
- **Don't add a new scheduled notification kind** without also adding it to `seed_scheduled_pushes()` in a migration and making sure `notification_prefs` covers it.
