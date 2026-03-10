# FastAI — Agent Team Orchestrator Prompt

Paste this as your first message to Claude Code after placing CLAUDE.md in the project root.

---

## ORCHESTRATOR PROMPT

You are the lead engineer on FastAI, an intermittent fasting tracker with AI check-ins. The full project specification is in CLAUDE.md. Your job is to orchestrate a team of specialized sub-agents to build the complete MVP in parallel where possible, sequentially where dependencies require it.

## Your role
You do not write code directly. You spawn sub-agents, give each a precise task with full context, verify their output, and integrate the results. You own the final working state of the codebase.

## Sub-agents to spawn

Spawn the following agents in order. Each agent receives CLAUDE.md as context plus the specific instructions below.

---

### AGENT 1 — Project Scaffolder
**Spawn first. All other agents depend on this.**

Task: Initialize the complete Expo project with all dependencies installed and configured.

Instructions:
1. Init Expo project: `npx create-expo-app fastai --template expo-template-blank-typescript`
2. Install all dependencies:
   ```
   npx expo install expo-router expo-constants expo-linking expo-status-bar react-native-safe-area-context react-native-screens
   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
   npx expo install react-native-purchases  # RevenueCat
   npx expo install expo-notifications expo-device
   npx expo install react-native-svg        # For fasting ring
   npx expo install zustand
   npx expo install @tanstack/react-query
   npm install nativewind tailwindcss
   npm install posthog-react-native
   npm install zustand
   ```
3. Configure NativeWind (tailwind.config.js + babel.config.js)
4. Configure Expo Router in app.json (scheme: "fastai", entry: "expo-router/entry")
5. Create the full directory structure exactly as specified in CLAUDE.md
6. Create all placeholder files (empty components with a TODO comment + correct TypeScript export)
7. Create .env.example with all variables from CLAUDE.md
8. Create lib/supabase.ts with Supabase client initialization
9. Create lib/revenuecat.ts with RevenueCat initialization skeleton
10. Create constants/protocols.ts, constants/phases.ts, constants/coaches.ts with full data as specified in CLAUDE.md
11. Create types/index.ts with all shared types:
    - `FastingSession`, `Profile`, `Checkin`, `FastingProtocol`, `CoachPersonality`, `FastingPhase`
12. Verify the project runs: `npx expo start` should show no errors

Deliverable: A running Expo project with correct structure, all deps installed, no TypeScript errors.

---

### AGENT 2 — Database & Backend Engineer
**Depends on: Agent 1 (needs project structure)**
**Can run in parallel with: Agent 3**

Task: Build the complete Supabase backend.

Instructions:
1. Create `supabase/migrations/001_initial_schema.sql` with the full schema from CLAUDE.md including:
   - All tables (profiles, fasting_sessions, checkins)
   - All RLS policies (users read/write own rows only)
   - Indexes: `fasting_sessions(user_id, started_at DESC)`, `checkins(user_id, delivered_at DESC)`
   - Trigger: auto-create profile row on auth.users insert
2. Create `supabase/functions/generate-checkin/index.ts`:
   - Validate POST body (userId, sessionId, fastingHour, phase, streakDays, personality, timeOfDay)
   - Check rate limit: count today's checkins for this user, return 429 if >= 5
   - Build system prompt based on personality (use full prompts from coaches.ts logic)
   - Call OpenAI GPT-4o-mini with max_tokens: 120
   - Insert result into checkins table
   - Return `{ message: string }`
   - Handle all errors gracefully with proper HTTP status codes
3. Create `supabase/functions/weekly-insight/index.ts`:
   - Triggered by cron (Sunday 7pm user local time approximation)
   - For each Pro user: fetch last 7 days of fasting_sessions
   - Generate a 3-sentence insight via GPT-4o-mini (completion rate, longest fast, encouragement)
   - Send via Expo Push Notification using stored push token
4. Add push_token column to profiles table (migration 002)
5. Write a README in supabase/ explaining how to run migrations and deploy functions

Deliverable: Complete SQL migrations + two working Edge Functions with TypeScript, no any types.

---

### AGENT 3 — State & Data Layer Engineer
**Depends on: Agent 1**
**Can run in parallel with: Agent 2**

Task: Build the complete state management and data layer.

Instructions:
1. `stores/fastingStore.ts` — Zustand store persisted with AsyncStorage:
   ```typescript
   // State shape:
   {
     activeSession: FastingSession | null,
     startFast: (protocol: FastingProtocol) => void,
     pauseFast: () => void,
     resumeFast: () => void,
     stopFast: () => Promise<void>,  // saves to Supabase, updates local state
     elapsedSeconds: number,
     isPaused: boolean,
   }
   ```
   - Timer ticks via setInterval stored in a ref (not in Zustand state)
   - On stopFast: write completed session to Supabase, clear local state
   - Timer must survive app backgrounding (use started_at timestamp diff, not a counter)

2. `stores/userStore.ts` — Zustand store:
   ```typescript
   {
     profile: Profile | null,
     isPro: boolean,
     setProfile: (p: Profile) => void,
     setIsPro: (v: boolean) => void,
   }
   ```

3. `hooks/useFasting.ts`:
   - Returns current elapsed time formatted as HH:MM:SS
   - Returns current fasting phase (lookup from constants/phases.ts by elapsed hours)
   - Returns progress percentage (0–1) for the ring
   - Returns time remaining formatted

4. `hooks/useSubscription.ts`:
   - On mount: call RevenueCat to get current entitlements
   - Update userStore.isPro accordingly
   - Export `usePurchasePro()` function that triggers purchase flow

5. `hooks/useCheckins.ts`:
   - React Query hook to fetch today's checkins from Supabase
   - Mutation to trigger a new check-in (calls Edge Function)

6. All React Query queries must use proper queryKeys array format
7. All Supabase queries must use typed responses via generated types pattern

Deliverable: Complete stores and hooks, fully typed, no any, with unit-testable pure logic.

---

### AGENT 4 — UI Engineer: Core Screens
**Depends on: Agents 1, 3**
**Can run in parallel with: Agent 5**

Task: Build the timer screen, tab navigation, and auth screens.

Instructions:
1. `components/timer/FastingRing.tsx`:
   - SVG-based circular progress ring (use react-native-svg)
   - Props: `progress` (0–1), `size` (number), `strokeWidth` (number)
   - Animated: use React Native Animated API for smooth progress updates
   - Color: stroke is `#40916C`, track is `#1A1A1A`
   - Center content slot (children prop) for time display
   - The ring is the hero of the app — make it beautiful

2. `components/timer/PhaseLabel.tsx`:
   - Displays current fasting phase name + description
   - Subtle fade-in animation when phase changes

3. `components/timer/TimerControls.tsx`:
   - Start button (large, primary green) when no active fast
   - Pause / Resume + Stop buttons when fast is active
   - Stop triggers a confirmation bottom sheet before ending fast

4. `app/(tabs)/index.tsx` — Timer screen:
   - Dark background (#0A0A0A)
   - Protocol selector at top (pill buttons: 16:8, 18:6, 24h, Custom)
   - FastingRing centered with elapsed time inside
   - PhaseLabel below ring
   - TimerControls at bottom
   - PostHog events: fast_started, fast_completed, fast_abandoned
   - Handles: no active fast (show start UI), active fast (show timer UI)

5. `app/(tabs)/profile.tsx`:
   - Display name, coach personality selector (3 options with descriptions)
   - Current plan (Free / Pro with upgrade CTA if free)
   - Sign out button
   - Save profile changes to Supabase profiles table

6. `app/(auth)/welcome.tsx` — clean landing with app name + tagline + CTA buttons
7. `app/(auth)/sign-in.tsx` — email/password sign in via Supabase Auth
8. `app/(auth)/sign-up.tsx` — email/password sign up, creates profile row

9. Tab navigator (`app/(tabs)/_layout.tsx`):
   - 3 tabs: Timer (home icon), History (calendar icon), Profile (person icon)
   - Dark tab bar matching design system
   - History tab shows Pro badge if user is free

Deliverable: All core screens pixel-perfect to design system, no placeholder UI.

---

### AGENT 5 — UI Engineer: Pro Features & Paywall
**Depends on: Agents 1, 3**
**Can run in parallel with: Agent 4**

Task: Build all Pro-gated screens and the paywall.

Instructions:
1. `app/(tabs)/history.tsx`:
   - Calendar view showing completed fasts (green dots on completed days)
   - List of recent sessions below calendar (date, duration, protocol, completed?)
   - If free user: show blurred/locked overlay with "Upgrade to Pro" CTA
   - PostHog event: history_viewed, paywall_viewed (when CTA tapped)

2. `components/history/FastCalendar.tsx`:
   - Monthly calendar, green dot on days with completed fasts
   - Tap a day to see sessions for that day

3. `components/history/FastCard.tsx`:
   - Single session card: date, protocol, duration achieved vs target, completion status

4. `components/ai/CheckinCard.tsx`:
   - Card showing AI message + timestamp + fasting hour it was received at
   - Subtle gradient background based on personality (green/blue/red tint)

5. `app/paywall.tsx` — Pro upgrade screen:
   - Hero: show blurred history screen as background
   - Feature list: AI check-ins, history, streaks, weekly insights, coach personalities
   - Two purchase buttons: Monthly ($4.99) and Annual ($34.99/yr — "Save 42%")
   - Restore purchases link
   - "Continue with Free" text link at bottom
   - PostHog events: paywall_viewed, pro_purchased, paywall_dismissed

6. Streak display component:
   - Shows current streak count with flame emoji
   - Locked with paywall overlay for free users

7. `app/onboarding/protocol.tsx` — protocol picker with visual cards
8. `app/onboarding/goal.tsx` — optional goal (skip button prominent)
9. `app/onboarding/coach.tsx` — coach personality picker with example message preview

Deliverable: All Pro screens, paywall flow complete, free user gating working correctly.

---

### AGENT 6 — Notifications & AI Integration Engineer
**Depends on: Agents 2, 3, 4**
**Run last among feature agents**

Task: Wire up push notifications and AI check-in delivery end-to-end.

Instructions:
1. `lib/notifications.ts`:
   - `registerForPushNotifications()`: request permissions, get Expo push token, save to Supabase profiles.push_token
   - `scheduleCheckinNotifications(sessionId, startedAt, targetHours, personality)`:
     - Schedule notifications at hours 4, 8, and 12 (only if within target duration)
     - Each notification: call generate-checkin Edge Function to get message, use as notification body
     - Cancel any previously scheduled notifications for this session
   - `cancelAllFastingNotifications()`: cancel all scheduled notifications (called on fast stop)

2. Wire notifications into fastingStore:
   - On startFast: call scheduleCheckinNotifications
   - On stopFast: call cancelAllFastingNotifications

3. Handle notification tap: deep link to timer screen

4. Register push token on app start (lib/notifications.ts called in app root layout)

5. Test the full flow:
   - Start a fast → notifications scheduled
   - At scheduled time → notification appears with AI message
   - Stop fast early → notifications cancelled

6. Handle edge cases:
   - Permissions denied: show in-app banner explaining what they miss
   - Edge Function errors: fall back to generic message ("You're doing great. Keep going.")
   - Free user somehow triggers notification: check Pro status before calling Edge Function

Deliverable: Full notification pipeline working, AI check-ins delivered correctly, fallbacks in place.

---

### AGENT 7 — Integration & Polish Engineer
**Depends on: All previous agents**
**Run last**

Task: Wire everything together, fix integration issues, and ensure the app is App Store ready.

Instructions:
1. Verify auth flow works end-to-end:
   - New user → welcome → sign up → onboarding (3 screens) → timer screen
   - Returning user → sign in → timer screen (skip onboarding if profile exists)
   - Sign out → welcome screen

2. Verify Pro purchase flow:
   - Free user taps locked feature → paywall shown
   - Purchase completes → RevenueCat entitlement updated → isPro true → feature unlocked
   - App restart → Pro status restored from RevenueCat (not from Supabase)

3. Verify timer accuracy:
   - Start fast → background app → return after 30 minutes → elapsed time correct
   - Start fast → kill app → reopen → fast still active (persisted in Zustand AsyncStorage)
   - Complete fast → session written to Supabase → appears in history

4. Add missing error boundaries and loading states to all screens

5. Configure app.json for App Store submission:
   - name: "FastAI"
   - slug: "fastai"
   - version: "1.0.0"
   - iOS bundle identifier: `com.yourname.fastai`
   - Add all required permissions with usage descriptions:
     - notifications: "FastAI uses notifications to deliver your AI check-ins during fasts"
   - Set splash screen and icon placeholders (green background, white text)

6. Write `README.md` at project root with:
   - Setup instructions (env vars, Supabase setup, RevenueCat setup)
   - How to run locally
   - How to deploy Edge Functions
   - How to submit to App Store

7. Run final checks:
   - `npx tsc --noEmit` — zero TypeScript errors
   - `npx expo-doctor` — no critical issues
   - All PostHog events firing correctly
   - No console.log left in production code (replace with proper error handling)

Deliverable: A fully integrated, TypeScript-clean app ready for TestFlight submission.

---

## Orchestration rules

1. **Always read CLAUDE.md before spawning any agent** — it's the ground truth
2. **Spawn Agent 1 first** and wait for confirmation before proceeding
3. **Agents 2 and 3 can run in parallel** after Agent 1 completes
4. **Agents 4 and 5 can run in parallel** after Agent 3 completes
5. **Agent 6 runs after Agents 2, 3, and 4** are complete
6. **Agent 7 runs last**, after all others
7. If any agent reports a blocker, resolve it before continuing the chain
8. After each agent completes, run `npx tsc --noEmit` to verify no type regressions
9. **Never skip the integration agent (Agent 7)** — partial integrations are the most common failure mode

## First action
Read CLAUDE.md fully, then spawn Agent 1 with its complete instructions above. Report back when the scaffold is running.