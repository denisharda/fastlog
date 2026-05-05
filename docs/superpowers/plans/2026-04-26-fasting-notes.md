# Fasting Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `fasting_notes` table that stores a mood per completed fast, wire the success-screen "Save to journal" button to actually save, surface the saved mood read-only on the history detail drawer, and sync the data across devices.

**Architecture:** New 1:1-with-session table `public.fasting_notes` with a `mood` text column and a `metadata jsonb` bag for future fields. Multi-device sync uses the existing `last_modified_by_device` convention plus Realtime publication. Read path is React Query (no Zustand store). Write path is fire-and-forget upsert from the success screen with explicit cache invalidation on success (originator skips its own Realtime echo).

**Tech Stack:** Supabase Postgres + Realtime, RLS, React Query, Zustand (read-only), expo-router, NativeWind, react-native-svg.

**Project test reality:** This project has no JS/RN test runner configured. Verification per task uses `npm run typecheck` and `npm run lint` plus manual smoke testing on the iOS simulator. Edge function tests exist but aren't relevant here.

**Spec:** `docs/superpowers/specs/2026-04-26-fasting-notes-design.md`

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `supabase/migrations/012_fasting_notes.sql` | Create | Table, indexes, RLS, updated_at trigger, Realtime publication |
| `constants/moods.ts` | Create | Single source of truth for the `Mood` value↔label mapping (shared by success screen + drawer) |
| `types/index.ts` | Modify | Add `Mood` and `FastingNote` types |
| `lib/fastingNotes.ts` | Create | `upsertFastingNote()` helper |
| `lib/posthog.ts` | Modify | Add `trackFastMoodLogged` typed helper |
| `hooks/useFastingNote.ts` | Create | React Query hook keyed on session id |
| `lib/realtime.ts` | Modify | Subscribe to `fasting_notes` INSERT/UPDATE; invalidate query on remote change |
| `app/fast-complete.tsx` | Modify | Drop default mood, switch picker to use shared `MOODS`, wire Save button to upsert + invalidate + track |
| `components/history/SessionDetailDrawer.tsx` | Modify | Render saved mood (emoji + label) when present |

---

## Task 1: Create the `fasting_notes` migration

**Files:**
- Create: `supabase/migrations/012_fasting_notes.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 012_fasting_notes.sql
-- Per-session journal: stores the user's mood after completing a fast,
-- plus a metadata jsonb bag for future fields (energy, free-form note, etc.).
-- 1:1 with fasting_sessions enforced by unique(session_id) so the client
-- can upsert on conflict.

create table public.fasting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.fasting_sessions(id) on delete cascade,
  mood text check (mood in ('rough','meh','good','great','amazing')),
  metadata jsonb not null default '{}'::jsonb,
  last_modified_by_device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

create index idx_fasting_notes_user on public.fasting_notes (user_id);

-- updated_at trigger
create or replace function public.touch_fasting_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger fasting_notes_set_updated_at
  before update on public.fasting_notes
  for each row execute function public.touch_fasting_notes_updated_at();

-- RLS
alter table public.fasting_notes enable row level security;

create policy "read own notes"
  on public.fasting_notes for select
  using (auth.uid() = user_id);

create policy "insert own notes"
  on public.fasting_notes for insert
  with check (auth.uid() = user_id);

create policy "update own notes"
  on public.fasting_notes for update
  using (auth.uid() = user_id);

create policy "delete own notes"
  on public.fasting_notes for delete
  using (auth.uid() = user_id);

-- Realtime publication
alter publication supabase_realtime add table public.fasting_notes;
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase dashboard SQL editor (paste the file's contents) **or** the CLI:

```bash
supabase migration up
```

Expected: success message, `fasting_notes` table visible in dashboard → Database → Tables.

- [ ] **Step 3: Verify the schema, RLS, and Realtime**

In the Supabase SQL editor, run:

```sql
-- Table + columns
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'fasting_notes'
order by ordinal_position;

-- Policies
select polname, polcmd from pg_policy
where polrelid = 'public.fasting_notes'::regclass;

-- Realtime publication membership
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'fasting_notes';
```

Expected:
- Eight columns including `mood` (text, nullable), `metadata` (jsonb, default `'{}'::jsonb`), `last_modified_by_device` (text, nullable), `unique (session_id)` constraint visible under indexes.
- Four policies (`read own notes`, `insert own notes`, `update own notes`, `delete own notes`).
- One row from the publication query (table is published for Realtime).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_fasting_notes.sql
git commit -m "feat(db): fasting_notes table with mood + metadata jsonb"
```

---

## Task 2: Add the shared `MOODS` constant

**Files:**
- Create: `constants/moods.ts`

- [ ] **Step 1: Write the file**

```ts
// constants/moods.ts
// Shared mood vocabulary used by the fast-complete picker and the
// history detail drawer. The `value` is the canonical lowercase string
// stored in `fasting_notes.mood`; the `label` is shown to the user.

export type Mood = 'rough' | 'meh' | 'good' | 'great' | 'amazing';

export interface MoodOption {
  value: Mood;
  emoji: string;
  label: string;
}

export const MOODS: ReadonlyArray<MoodOption> = [
  { value: 'rough',   emoji: '😣', label: 'Rough' },
  { value: 'meh',     emoji: '😐', label: 'Meh' },
  { value: 'good',    emoji: '🙂', label: 'Good' },
  { value: 'great',   emoji: '😊', label: 'Great' },
  { value: 'amazing', emoji: '🤩', label: 'Amazing' },
];

export function moodOption(value: Mood | null | undefined): MoodOption | null {
  if (!value) return null;
  return MOODS.find(m => m.value === value) ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors introduced (the file is new, fully self-contained).

- [ ] **Step 3: Commit**

```bash
git add constants/moods.ts
git commit -m "feat: shared MOODS constant for mood vocabulary"
```

---

## Task 3: Add `Mood` and `FastingNote` types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Edit `types/index.ts`**

Add at the bottom of the file (below the existing `HydrationLog` interface):

```ts
export type { Mood } from '../constants/moods';

export interface FastingNote {
  id: string;
  user_id: string;
  session_id: string;
  mood: import('../constants/moods').Mood | null;
  metadata: Record<string, unknown>;
  last_modified_by_device: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add FastingNote + re-export Mood"
```

---

## Task 4: Implement `upsertFastingNote`

**Files:**
- Create: `lib/fastingNotes.ts`

- [ ] **Step 1: Write the helper**

```ts
// lib/fastingNotes.ts
// Upserts the per-session mood note. 1:1 with fasting_sessions enforced
// by the unique(session_id) constraint, so on_conflict targets session_id.
// Stamps last_modified_by_device per the project's multi-device-sync
// convention so Realtime echo handlers can skip the originator.

import { supabase } from './supabase';
import { getDeviceId } from './deviceId';
import type { Mood } from '../constants/moods';

export async function upsertFastingNote(args: {
  sessionId: string;
  userId: string;
  mood: Mood;
}): Promise<void> {
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from('fasting_notes')
    .upsert(
      {
        session_id: args.sessionId,
        user_id: args.userId,
        mood: args.mood,
        last_modified_by_device: deviceId,
      },
      { onConflict: 'session_id' },
    );
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: no errors, no new warnings.

- [ ] **Step 3: Commit**

```bash
git add lib/fastingNotes.ts
git commit -m "feat: upsertFastingNote helper"
```

---

## Task 5: Add `trackFastMoodLogged` PostHog helper

**Files:**
- Modify: `lib/posthog.ts`

- [ ] **Step 1: Add the typed helper**

Add the following function near the other `track*` helpers (e.g. after `trackFastAbandoned` on line 51):

```ts
export function trackFastMoodLogged(props: {
  mood: 'rough' | 'meh' | 'good' | 'great' | 'amazing';
  sessionId: string;
}): void {
  posthogInstance?.capture('fast_mood_logged', {
    mood: props.mood,
    session_id: props.sessionId,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/posthog.ts
git commit -m "feat(analytics): trackFastMoodLogged event"
```

---

## Task 6: Implement `useFastingNote` hook

**Files:**
- Create: `hooks/useFastingNote.ts`

- [ ] **Step 1: Write the hook**

```ts
// hooks/useFastingNote.ts
// Read-side hook for the per-session note. Returns null when no note
// has been saved (maybeSingle short-circuits the missing-row case).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { FastingNote } from '../types';

export function fastingNoteQueryKey(sessionId: string | null | undefined) {
  return ['fasting_note', sessionId] as const;
}

export function useFastingNote(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: fastingNoteQueryKey(sessionId),
    enabled: !!sessionId,
    queryFn: async (): Promise<FastingNote | null> => {
      const { data, error } = await supabase
        .from('fasting_notes')
        .select('*')
        .eq('session_id', sessionId!)
        .maybeSingle();
      if (error) throw error;
      return (data as FastingNote | null) ?? null;
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useFastingNote.ts
git commit -m "feat: useFastingNote React Query hook"
```

---

## Task 7: Wire `fasting_notes` into Realtime

**Files:**
- Modify: `lib/realtime.ts`

- [ ] **Step 1: Add imports for the query client and the query key**

At the top of `lib/realtime.ts`, add to the existing imports:

```ts
import { queryClient } from './queryClient';
import { fastingNoteQueryKey } from '../hooks/useFastingNote';
```

(Note: there is no shared `queryClient` module yet — it's currently created inline inside `app/_layout.tsx`. Step 2 fixes that.)

- [ ] **Step 2: Extract the QueryClient into a shared module**

Create `lib/queryClient.ts`:

```ts
// lib/queryClient.ts
// Single QueryClient shared by the React provider in app/_layout.tsx
// and by Realtime handlers in lib/realtime.ts that need to invalidate
// caches on remote changes.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});
```

In `app/_layout.tsx`, replace the inline `const queryClient = new QueryClient({ … })` block with:

```ts
import { queryClient } from '../lib/queryClient';
```

(Delete the inline `const queryClient = …` declaration. The `<QueryClientProvider client={queryClient}>` JSX stays the same.)

- [ ] **Step 3: Add the row type, handler, and channel filters**

Inside `lib/realtime.ts`, add a new row type alongside the existing `FastingSessionRow` and `HydrationLogRow`:

```ts
interface FastingNoteRow {
  id: string;
  user_id: string;
  session_id: string;
  last_modified_by_device: string | null;
}
```

Add a handler alongside the existing `handleFastingInsert` / `handleHydrationInsert` etc.:

```ts
async function handleFastingNoteChange(row: FastingNoteRow) {
  const deviceId = await ensureDeviceId();
  if (row.last_modified_by_device === deviceId) return; // own echo
  queryClient.invalidateQueries({ queryKey: fastingNoteQueryKey(row.session_id) });
}
```

Inside `startRealtime`, add two new `.on(...)` filters to the channel chain (after the existing hydration_logs DELETE filter, before `.subscribe(...)`):

```ts
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fasting_notes', filter: `user_id=eq.${userId}` },
      (p) => void handleFastingNoteChange(p.new as FastingNoteRow),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'fasting_notes', filter: `user_id=eq.${userId}` },
      (p) => void handleFastingNoteChange(p.new as FastingNoteRow),
    )
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `app/_layout.tsx` had any leftover imports of `QueryClient` they should be removed; only `QueryClientProvider` is still needed there.)

- [ ] **Step 5: Manual smoke check that nothing regressed**

Run the iOS dev build:

```bash
npm run ios
```

Sign in, start a fast, and end it. Verify the existing Realtime sync still works (no new console errors mentioning `fasting_notes`, timer/water still update across foreground app states). This is just a regression check — the new path isn't exercised yet.

- [ ] **Step 6: Commit**

```bash
git add lib/realtime.ts lib/queryClient.ts app/_layout.tsx
git commit -m "feat(realtime): subscribe to fasting_notes; share QueryClient module"
```

---

## Task 8: Wire the success-screen Save button

**Files:**
- Modify: `app/fast-complete.tsx`

- [ ] **Step 1: Replace the local `MOODS` array and default mood**

In `app/fast-complete.tsx`:

a) Remove the local `MOODS` constant (lines 19-25) entirely.

b) Add to the imports section:

```ts
import { MOODS, Mood } from '../constants/moods';
import { useQueryClient } from '@tanstack/react-query';
import { upsertFastingNote } from '../lib/fastingNotes';
import { trackFastMoodLogged } from '../lib/posthog';
import { fastingNoteQueryKey } from '../hooks/useFastingNote';
```

c) Change the mood state declaration (currently line 46):

```ts
// before
const [mood, setMood] = useState<string | null>('Great');

// after
const [mood, setMood] = useState<Mood | null>(null);
```

d) Inside the component body, near the other hooks (e.g. just under the `shareSheetRef` declaration around line 45):

```ts
const queryClient = useQueryClient();
```

- [ ] **Step 2: Update the mood picker rendering to use `value`**

Replace the `MOODS.map(m => { … })` block (currently lines 338-376) with:

```tsx
{MOODS.map(m => {
  const isSel = mood === m.value;
  return (
    <Pressable
      key={m.value}
      onPress={() => {
        Haptics.selectionAsync();
        setMood(m.value);
      }}
      style={{ alignItems: 'center', flex: 1 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isSel ? hexAlpha(theme.primary, 0x22) : theme.surface2,
          borderWidth: 2,
          borderColor: isSel ? theme.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
      </View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: isSel ? '700' : '500',
          color: isSel ? theme.primary : theme.textFaint,
          marginTop: 4,
          letterSpacing: 0.1,
        }}
      >
        {m.label}
      </Text>
    </Pressable>
  );
})}
```

- [ ] **Step 3: Wire the `Save to journal` button**

Replace the `<PrimaryButton ...>Save to journal</PrimaryButton>` block (currently around line 381) with:

```tsx
<PrimaryButton
  theme={theme}
  onPress={() => {
    if (session && profile?.id && mood) {
      upsertFastingNote({ sessionId: session.id, userId: profile.id, mood })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: fastingNoteQueryKey(session.id) }),
        )
        .catch(e => console.warn('[fast-complete] mood save failed', e));
      trackFastMoodLogged({ mood, sessionId: session.id });
    }
    router.back();
  }}
>
  Save to journal
</PrimaryButton>
```

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: no errors. (TypeScript will catch any leftover string-typed `mood` usage.)

- [ ] **Step 5: Manual smoke test**

Run the iOS build:

```bash
npm run ios
```

Then on the simulator/device:

1. Sign in (or use an existing account).
2. Start a 16:8 fast (or any short custom fast you can complete; for development you can backfill `started_at` in Supabase to a few seconds ago to trigger completion immediately).
3. Once the success screen appears, confirm: emojis are all unselected (no default `Great`).
4. Tap an emoji — confirm haptic + ring highlight.
5. Tap **Save to journal** — confirm the screen dismisses immediately.
6. In the Supabase dashboard → Table editor → `fasting_notes`, confirm a row appears with `mood` set, the correct `session_id`, `user_id`, and a non-null `last_modified_by_device`.
7. Re-trigger the success screen for the same session (e.g., navigate back via the history list while still in dev), tap a different mood, save, and confirm the same row's `mood` and `updated_at` change (upsert path).
8. Skip-tap path: complete another fast, dismiss with the **X** without tapping a mood — confirm **no** row is written for that session.

- [ ] **Step 6: Commit**

```bash
git add app/fast-complete.tsx
git commit -m "feat(fast-complete): save mood to fasting_notes on Save to journal"
```

---

## Task 9: Surface mood on the history detail drawer

**Files:**
- Modify: `components/history/SessionDetailDrawer.tsx`

- [ ] **Step 1: Add imports**

Add to the imports block at the top:

```ts
import { useFastingNote } from '../../hooks/useFastingNote';
import { moodOption } from '../../constants/moods';
```

- [ ] **Step 2: Fetch the note for the currently-selected session**

Inside the `SessionDetailDrawer` component, after the existing `useDailyHydration` / `useHydration` calls (around line 74-75):

```ts
const { data: note } = useFastingNote(session?.id ?? null);
const mood = moodOption(note?.mood ?? null);
```

- [ ] **Step 3: Render a mood card above the existing Notes block**

Locate the existing notes block (currently lines 331-336):

```tsx
{/* Notes */}
{session!.notes && (
  <View className="rounded-2xl p-4 mb-3" style={cardStyle}>
    <Text className="text-xs mb-1" style={{ color: theme.textMuted }}>Notes</Text>
    <Text className="text-sm italic" style={{ color: theme.text }}>{session!.notes}</Text>
  </View>
)}
```

Immediately above it, add:

```tsx
{/* Mood */}
{mood && (
  <View className="rounded-2xl p-4 mb-3" style={cardStyle}>
    <Text className="text-xs mb-1" style={{ color: theme.textMuted }}>Mood</Text>
    <View className="flex-row items-center gap-3">
      <Text style={{ fontSize: 28 }}>{mood.emoji}</Text>
      <Text className="text-base font-semibold" style={{ color: theme.text }}>
        {mood.label}
      </Text>
    </View>
  </View>
)}
```

(No placeholder rendered when there's no mood — keep the drawer clutter-free.)

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Manual smoke test (single device)**

Run `npm run ios`. On the simulator:

1. Open the History tab and tap a calendar day with a completed session whose mood you saved in Task 8.
2. Confirm the drawer shows the Mood card with the correct emoji + label.
3. Tap a calendar day for a session with **no** saved mood — confirm the Mood card is absent (and the drawer otherwise renders correctly).
4. Switch between sessions in a multi-session day — confirm the Mood card updates per-session (or disappears when you switch to one without a saved mood).

- [ ] **Step 6: Manual smoke test (multi-device sync)**

If a second device is available:

1. On Device A, complete a fast and save a mood.
2. On Device B, foreground the app, open History, and tap the same day. Confirm the mood appears (Realtime path).
3. On Device B, kill the app and re-launch it. Confirm the mood still appears (cold-launch fetch via React Query).

If only one device is available, skip step 6 and verify Realtime indirectly by changing the row in Supabase manually:

```sql
update public.fasting_notes
set mood = 'amazing',
    last_modified_by_device = 'manual-test'
where session_id = '<session id from step 1>';
```

Then on Device A (foregrounded with the drawer open), confirm the emoji updates within ~1 second.

- [ ] **Step 7: Commit**

```bash
git add components/history/SessionDetailDrawer.tsx
git commit -m "feat(history): show saved mood in session detail drawer"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full typecheck + lint**

```bash
npm run typecheck
npm run lint
```
Expected: zero errors, no new warnings.

- [ ] **Step 2: Confirm migration is committed and applied**

```bash
ls supabase/migrations/012_fasting_notes.sql
git log --oneline -- supabase/migrations/012_fasting_notes.sql
```
Confirm the migration is present and was committed in Task 1. Confirm it's applied to the remote Supabase project (re-run the verification SQL from Task 1 Step 3 if unsure).

- [ ] **Step 3: Smoke walkthrough end-to-end**

Final manual run:

1. Cold-launch the app (force quit + relaunch).
2. Complete a fast.
3. Tap a mood, hit **Save to journal**.
4. Open History → that day → confirm the Mood card shows.
5. Force-quit and relaunch — confirm the mood still shows.
6. End another fast, dismiss the success screen with the X (no mood) — confirm no Mood card for that session in History.

- [ ] **Step 4: No further commit unless something needed touching up.** All commits should already be in place from per-task commits.

---

## Out of scope (deferred)

These were identified during brainstorming and are explicitly **not** part of this plan:

- Editing mood after save (drawer is read-only).
- Showing mood in the history list/calendar dots.
- A free-form `metadata.note` text field with tap-to-edit.
- Mood on the share card.
- Server-side fan-out of mood changes via push notification.
