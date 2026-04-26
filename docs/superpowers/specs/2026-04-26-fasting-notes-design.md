# Fasting Notes — Design

**Date:** 2026-04-26
**Status:** Approved (brainstorm)

## Context

The fast-complete success screen (`app/fast-complete.tsx`) collects a mood emoji ("How did it feel?") and shows a "Save to journal" button. Today the mood is held in local component state and the button only calls `router.back()` — nothing is persisted. This spec adds a `fasting_notes` table to durably capture the mood per fast and to leave room for future per-fast metadata (energy, free-form note, body weight, etc.) without further schema churn.

## Goals

- Persist a mood selection per completed fast.
- Sync the saved mood across the user's devices using the same conventions as `fasting_sessions` and `hydration_logs`.
- Surface the saved mood on the history detail drawer.
- Keep the schema extensible (one bag for future fields) without committing to those fields now.

## Non-goals (v1)

- Editing mood after save (drawer is read-only).
- Showing mood in the history list/calendar.
- Free-form journal text or other typed columns in `metadata`.
- Including mood in the share card.

## Data model

New table `public.fasting_notes`. **One row per fasting session (1:1).**

```sql
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
```

**Why each piece:**
- `unique (session_id)` enforces 1:1 and lets the client `upsert ... on conflict (session_id)`.
- `mood` is nullable + check-constrained — matches the existing `profiles.preferred_protocol` pattern (no Postgres enum type).
- `metadata jsonb` is the future-proof bag. Empty object today; new fields land here without migrations.
- `last_modified_by_device` mirrors the project-wide multi-device-sync convention so Realtime echo handlers can skip originator-self updates.
- Cascading delete on both FKs — if a session or profile is deleted, its notes go with it.

### Triggers

`updated_at` is bumped on every UPDATE via `touch_fasting_notes_updated_at()`:

```sql
create or replace function public.touch_fasting_notes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger fasting_notes_set_updated_at
  before update on public.fasting_notes
  for each row execute function public.touch_fasting_notes_updated_at();
```

### RLS

```sql
alter table public.fasting_notes enable row level security;
create policy "read own notes"   on public.fasting_notes for select using (auth.uid() = user_id);
create policy "insert own notes" on public.fasting_notes for insert with check (auth.uid() = user_id);
create policy "update own notes" on public.fasting_notes for update using (auth.uid() = user_id);
create policy "delete own notes" on public.fasting_notes for delete using (auth.uid() = user_id);
```

### Realtime

```sql
alter publication supabase_realtime add table public.fasting_notes;
```

The migration file is `supabase/migrations/012_fasting_notes.sql`.

## Type definitions

In `types/index.ts`:

```ts
export type Mood = 'rough' | 'meh' | 'good' | 'great' | 'amazing';

export interface FastingNote {
  id: string;
  user_id: string;
  session_id: string;
  mood: Mood | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

## Write path

New file `lib/fastingNotes.ts` exports a single helper:

```ts
export async function upsertFastingNote(args: {
  sessionId: string;
  userId: string;
  mood: Mood;
}): Promise<void> {
  const { error } = await supabase
    .from('fasting_notes')
    .upsert(
      {
        session_id: args.sessionId,
        user_id: args.userId,
        mood: args.mood,
        last_modified_by_device: getDeviceId(),
      },
      { onConflict: 'session_id' },
    );
  if (error) throw error;
}
```

`app/fast-complete.tsx` changes:

- Initial mood state becomes `useState<Mood | null>(null)` — emojis render unselected.
- The `MOODS` array gains a `value: Mood` field so the picker writes the canonical lowercase string while still rendering the friendly label.
- "Save to journal" `onPress`:
  ```ts
  if (session && profile?.id && mood) {
    upsertFastingNote({ sessionId: session.id, userId: profile.id, mood })
      .then(() => queryClient.invalidateQueries({ queryKey: ['fasting_note', session.id] }))
      .catch(e => console.warn('[fast-complete] mood save failed', e));
    trackFastMoodLogged({ mood, sessionId: session.id });
  }
  router.back();
  ```
  Fire-and-forget so the modal dismisses instantly (matches the local-first ethos: timer + writes are decoupled). The post-success invalidation is required because the Realtime handler skips originator echoes, so same-device readers (history drawer) would otherwise see a stale cached `null` until React Query's `staleTime` (5 min) elapsed. If `mood` is null, the button just dismisses — same as the X. The button is not disabled in the no-mood case to avoid a dead-end UI.

`lib/posthog.ts` gains `trackFastMoodLogged({ mood, sessionId })` for parity with the existing typed `track*` helpers.

## Realtime wiring

`lib/realtime.ts` (currently subscribes to `fasting_sessions` + `hydration_logs`) adds a third filter on `fasting_notes` keyed by `user_id`. On INSERT and UPDATE:

- Skip if `payload.new.last_modified_by_device === getDeviceId()` (originator dedup, identical convention to existing channels).
- Otherwise call `queryClient.invalidateQueries({ queryKey: ['fasting_note', payload.new.session_id] })` so the history detail drawer (or any future consumer) re-fetches.

No Zustand store is added — there is no view that needs eager hydration on cold launch beyond what React Query handles on demand.

## Read path

New hook `hooks/useFastingNote.ts`:

```ts
export function useFastingNote(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: ['fasting_note', sessionId],
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

`components/history/SessionDetailDrawer.tsx` consumes the hook and, when `note?.mood` exists, renders the matching emoji + friendly label inline with the existing session details. When the mood is null/absent, nothing is rendered (no placeholder).

## Sync semantics

| Scenario | Mechanism | Latency |
|---|---|---|
| Same device save → drawer | React Query refetch on success (or invalidation) | <1s |
| Other device foregrounded | Realtime INSERT/UPDATE → invalidate `['fasting_note', sessionId]` | <1s |
| Other device cold launch | Drawer mounts, hook fetches | seconds |
| Originator's own echo | `last_modified_by_device === getDeviceId()` skip | n/a |

No Edge Function fan-out / push notifications for notes — they're cosmetic data, not time-critical.

## Files touched

| File | Change |
|---|---|
| `supabase/migrations/012_fasting_notes.sql` | New migration |
| `types/index.ts` | Add `Mood`, `FastingNote` |
| `lib/fastingNotes.ts` | New: `upsertFastingNote` |
| `lib/posthog.ts` | Add `trackFastMoodLogged` |
| `lib/realtime.ts` | Add `fasting_notes` channel + handler |
| `hooks/useFastingNote.ts` | New: React Query hook |
| `app/fast-complete.tsx` | Wire "Save to journal" + drop default mood |
| `components/history/SessionDetailDrawer.tsx` | Render mood when present |

## Open questions

None.

## Future work (deferred)

- Edit mood from the history detail drawer.
- Show mood in the history list/calendar.
- Free-form note field in `metadata` (`metadata.note: string`) with a tap-to-edit affordance in the drawer.
- Show mood on the share card.
