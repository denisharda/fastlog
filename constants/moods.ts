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
