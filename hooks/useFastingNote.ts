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
