import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';
import { useFastingStore } from '../stores/fastingStore';
import { Checkin, CheckinRequest } from '../types';
import { getCurrentPhase } from '../constants/phases';
import { trackCheckinReceived } from '../lib/posthog';

const MAX_CHECKINS_PER_DAY = 5;

/**
 * Fetch all check-ins for the active fasting session.
 */
export function useSessionCheckins(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['checkins', sessionId],
    queryFn: async (): Promise<Checkin[]> => {
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('session_id', sessionId)
        .order('delivered_at', { ascending: true });

      if (error) throw error;
      return data as Checkin[];
    },
    enabled: !!sessionId,
  });
}

/**
 * Trigger an AI check-in for the current fast hour.
 * Handles rate limiting (max 5/day) and Pro gating on the server side.
 */
export async function triggerCheckin(params: {
  fastingHour: number;
  elapsedHours: number;
}): Promise<string | null> {
  const { profile, isPro } = useUserStore.getState();
  const { activeFast } = useFastingStore.getState();

  if (!profile || !activeFast || !isPro) return null;

  const phase = getCurrentPhase(params.elapsedHours);
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay =
    hour < 6
      ? 'night'
      : hour < 12
      ? 'morning'
      : hour < 17
      ? 'afternoon'
      : hour < 21
      ? 'evening'
      : 'night';

  const body: CheckinRequest = {
    userId: profile.id,
    sessionId: activeFast.sessionId,
    fastingHour: params.fastingHour,
    phase: phase.name,
    streakDays: 0, // TODO: compute from fasting_sessions history
    personality: profile.coach_personality,
    timeOfDay,
  };

  const { data, error } = await supabase.functions.invoke<{ message: string }>(
    'generate-checkin',
    { body }
  );

  if (error) {
    console.error('[useCheckins] Edge Function error:', error);
    return null;
  }

  trackCheckinReceived({
    fastingHour: params.fastingHour,
    personality: profile.coach_personality,
  });

  return data?.message ?? null;
}
