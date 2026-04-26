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
