// lib/hydrationSync.ts
// Replace today's local hydrationStore logs with whatever the server says
// we logged today. Called on app foreground alongside syncWithRemote so a
// device that missed Realtime events while backgrounded catches up before
// the user sees stale totals.

import { supabase } from './supabase';
import { useUserStore } from '../stores/userStore';
import { useHydrationStore } from '../stores/hydrationStore';

export async function syncHydrationWithRemote(): Promise<void> {
  const userId = useUserStore.getState().profile?.id;
  if (!userId) return;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('hydration_logs')
    .select('id, amount_ml, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', startOfDay.toISOString())
    .order('logged_at', { ascending: true });

  if (error) {
    console.warn('[hydrationSync] fetch failed:', error);
    return;
  }

  const store = useHydrationStore.getState();
  // Rebuild local cache from server truth — this is the reconciling path.
  store.resetIfNewDay();
  // We need a direct setter; use the existing store.setState (zustand internal).
  useHydrationStore.setState({ todayLogs: (data ?? []).map((r) => ({
    id: r.id, amount_ml: r.amount_ml, logged_at: r.logged_at,
  })) });
}
