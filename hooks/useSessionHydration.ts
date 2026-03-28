import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';
import { HydrationLog } from '../types';

interface UseSessionHydrationReturn {
  logs: HydrationLog[];
  totalMl: number;
  logCount: number;
  isLoading: boolean;
}

/**
 * Fetches hydration logs for a specific fasting session from Supabase.
 * Returns empty data if sessionId is null.
 */
export function useSessionHydration(sessionId: string | null): UseSessionHydrationReturn {
  const profile = useUserStore((s) => s.profile);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['session_hydration', sessionId],
    queryFn: async (): Promise<HydrationLog[]> => {
      if (!sessionId || !profile?.id) return [];
      const { data, error } = await supabase
        .from('hydration_logs')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', profile.id)
        .order('logged_at', { ascending: true });
      if (error) throw error;
      return data as HydrationLog[];
    },
    enabled: !!sessionId && !!profile?.id,
  });

  const { totalMl, logCount } = useMemo(() => ({
    totalMl: logs.reduce((sum, log) => sum + log.amount_ml, 0),
    logCount: logs.length,
  }), [logs]);

  return { logs, totalMl, logCount, isLoading };
}
