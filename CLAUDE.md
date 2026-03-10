# FastAI — Project Intelligence

## What this project is
A React Native (Expo) intermittent fasting tracker with AI-powered check-ins.
Freemium model: free timer, Pro subscription unlocks AI check-ins, history, streaks, insights.
Target: iOS App Store. Stack is identical to SnapCook conventions.

## Stack
- **Frontend**: Expo SDK 51+, React Native, TypeScript, NativeWind (Tailwind for RN)
- **Routing**: Expo Router v3 (file-based, app/ directory)
- **Backend**: Supabase (auth, database, Edge Functions)
- **AI**: GPT-4o-mini via Supabase Edge Function (never call OpenAI directly from client)
- **Payments**: RevenueCat + expo-iap (iOS StoreKit)
- **Notifications**: Expo Push Notifications
- **Analytics**: PostHog React Native SDK
- **State**: Zustand for global state, React Query for server state

## Project structure
```
/
├── app/                        # Expo Router screens
│   ├── (auth)/                 # Unauthenticated screens
│   │   ├── welcome.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/                 # Main app tabs (authenticated)
│   │   ├── index.tsx           # Timer screen (Home)
│   │   ├── history.tsx         # Fasting history (Pro)
│   │   └── profile.tsx         # Settings / account
│   ├── onboarding/             # First-run onboarding flow
│   │   ├── protocol.tsx        # Pick fasting protocol
│   │   ├── goal.tsx            # Optional goal setting
│   │   └── coach.tsx           # Pick AI coach personality
│   └── paywall.tsx             # Pro upgrade screen
├── components/                 # Reusable UI components
│   ├── timer/
│   │   ├── FastingRing.tsx     # Circular progress ring (SVG)
│   │   ├── PhaseLabel.tsx      # "Fat burning", "Ketosis" etc.
│   │   └── TimerControls.tsx   # Start / pause / stop buttons
│   ├── history/
│   │   ├── FastCalendar.tsx
│   │   └── FastCard.tsx
│   ├── ai/
│   │   └── CheckinCard.tsx     # AI message display card
│   └── ui/                     # Base design system components
├── lib/
│   ├── supabase.ts             # Supabase client init
│   ├── revenuecat.ts           # RevenueCat init + hooks
│   ├── notifications.ts        # Push notification helpers
│   └── posthog.ts              # Analytics helpers
├── stores/
│   ├── fastingStore.ts         # Active fast state (Zustand)
│   └── userStore.ts            # User profile + Pro status
├── hooks/
│   ├── useFasting.ts           # Timer logic, phase calculation
│   ├── useSubscription.ts      # Pro status from RevenueCat
│   └── useCheckins.ts          # Fetch/trigger AI check-ins
├── supabase/
│   ├── migrations/             # SQL migration files
│   └── functions/
│       ├── generate-checkin/   # AI check-in Edge Function
│       └── weekly-insight/     # Weekly summary Edge Function
├── constants/
│   ├── protocols.ts            # Fasting protocol definitions
│   ├── phases.ts               # Fasting phase thresholds + labels
│   └── coaches.ts              # AI coach personality prompts
└── types/
    └── index.ts                # Shared TypeScript types
```

## Database schema (Supabase)

```sql
-- Users profile (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users primary key,
  name text,
  coach_personality text default 'motivational', -- motivational | calm | brutal
  preferred_protocol text default '16:8',
  created_at timestamptz default now()
);

-- Fasting sessions
create table fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  protocol text not null,           -- '16:8' | '18:6' | '24h' | 'custom'
  target_hours int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean default false,   -- true if user finished full fast
  notes text,
  created_at timestamptz default now()
);

-- AI check-in messages
create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references fasting_sessions(id) on delete cascade,
  message text not null,
  personality text not null,
  fasting_hour int not null,         -- which hour of the fast this was sent
  delivered_at timestamptz default now()
);

-- RLS policies: users can only read/write their own rows on all tables
```

## Fasting phases (constants/phases.ts)
```
0–4h:   "Fed State" — body still processing last meal
4–8h:   "Early Fasting" — insulin dropping
8–12h:  "Fat Burning Begins" — glycogen depleting
12–16h: "Fat Burning Peak" — ketosis starting
16–18h: "Autophagy Zone" — cellular cleanup
18h+:   "Deep Fast" — maximum benefits
```

## Fasting protocols (constants/protocols.ts)
```
16:8   — 16h fast, 8h eating window (default)
18:6   — 18h fast, 6h eating window
24h    — Full day fast (OMAD)
custom — User sets their own target hours (8–72h range)
```

## AI coach personalities (constants/coaches.ts)
Three personalities, each with a distinct system prompt:
- **motivational**: Warm, energetic, science-backed encouragement
- **calm**: Mindful, gentle, breathing/hydration focused
- **brutal**: Blunt, no-nonsense, zero sympathy for excuses

Check-in prompt must include: current fasting hour, phase name, streak count, coach personality, time of day.
Max response length: 2 sentences. No emojis unless personality is motivational.

## Edge Function: generate-checkin
Input (POST body):
```json
{
  "userId": "uuid",
  "sessionId": "uuid",
  "fastingHour": 12,
  "phase": "Fat Burning Peak",
  "streakDays": 5,
  "personality": "motivational",
  "timeOfDay": "morning"
}
```
Output:
```json
{ "message": "string" }
```
Rate limit: max 5 calls per user per day (check checkins table count before calling OpenAI).

## Paywall rules
The following features require Pro status (checked via RevenueCat):
- Viewing history screen (show blurred preview to free users)
- Viewing streak count
- Receiving AI check-ins
- Weekly insight notifications
- Custom AI coach selection
Free users always get: full timer functionality, start/pause/stop, basic start/end push notifications.

## Notification schedule (Pro only)
Triggered when a fast starts, scheduled for hours 4, 8, and 12 of the fast:
- Each notification fetches an AI check-in via the Edge Function
- Use Expo scheduled notifications with background fetch
- Cancel all scheduled notifications when fast is stopped early

## RevenueCat products
- `fastai_pro_monthly` — $4.99/month
- `fastai_pro_annual` — $34.99/year
Entitlement name: `pro`

## Code conventions
- TypeScript strict mode, no `any`
- NativeWind for all styling (no StyleSheet.create)
- All Supabase calls go through lib/supabase.ts client
- All OpenAI/AI calls go through Supabase Edge Functions only — never from client
- Zustand stores must be persisted with AsyncStorage via zustand/middleware
- Every screen must handle loading, error, and empty states
- Use React Query for all async data fetching from Supabase
- PostHog event on every meaningful user action (fast_started, fast_completed, fast_abandoned, paywall_viewed, pro_purchased, checkin_received)

## Design system
- Primary color: #2D6A4F (deep green)
- Accent: #40916C
- Background: #0A0A0A (near black — fasting app should feel calm/dark)
- Surface: #1A1A1A
- Text primary: #F5F5F5
- Text muted: #9CA3AF
- The timer ring is the hero element — it must be large, centered, beautiful
- Use SF Pro font on iOS (system default via NativeWind)

## Environment variables (.env)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_POSTHOG_KEY=
OPENAI_API_KEY=          # Supabase Edge Function secret only, never in app
```

## What NOT to do
- Never call OpenAI from the React Native client
- Never store subscription state in Supabase — always read from RevenueCat
- Never block the timer UI with a network request — timer is local-first
- Never make the paywall aggressive on first launch — show it contextually
- Never use expo-notifications for AI check-ins without checking Pro status first