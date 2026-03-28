import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';
import { HydrationLog } from '../types';

interface UseDailyHydrationReturn {
  logs: HydrationLog[];
  totalMl: number;
  logCount: number;
  isLoading: boolean;
}

/**
 * Fetches hydration logs for a specific day from Supabase.
 * dateString should be in toDateString() format (e.g., "Thu Mar 28 2026").
 */
export function useDailyHydration(dateString: string | null): UseDailyHydrationReturn {
  const profile = useUserStore((s) => s.profile);

  const { dayStart, dayEnd } = useMemo(() => {
    if (!dateString) return { dayStart: '', dayEnd: '' };
    const d = new Date(dateString);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { dayStart: start.toISOString(), dayEnd: end.toISOString() };
  }, [dateString]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['daily_hydration', dateString],
    queryFn: async (): Promise<HydrationLog[]> => {
      if (!profile?.id || !dayStart) return [];
      const { data, error } = await supabase
        .from('hydration_logs')
        .select('*')
        .eq('user_id', profile.id)
        .gte('logged_at', dayStart)
        .lt('logged_at', dayEnd)
        .order('logged_at', { ascending: true });
      if (error) throw error;
      return data as HydrationLog[];
    },
    enabled: !!dateString && !!profile?.id,
  });

  const { totalMl, logCount } = useMemo(() => ({
    totalMl: logs.reduce((sum, log) => sum + log.amount_ml, 0),
    logCount: logs.length,
  }), [logs]);

  return { logs, totalMl, logCount, isLoading };
}

/**
 * Fetches aggregated daily hydration totals for the last 28 days.
 * Returns a Record mapping dateString to totalMl.
 */
export function useDailyHydrationTotals(): Record<string, number> {
  const profile = useUserStore((s) => s.profile);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data = {} } = useQuery({
    queryKey: ['daily_hydration_totals', profile?.id],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!profile?.id) return {};
      const { data, error } = await supabase
        .from('hydration_logs')
        .select('amount_ml, logged_at')
        .eq('user_id', profile.id)
        .gte('logged_at', since);
      if (error) throw error;

      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        const dayKey = new Date(row.logged_at).toDateString();
        map[dayKey] = (map[dayKey] ?? 0) + row.amount_ml;
      }
      return map;
    },
    enabled: !!profile?.id,
  });

  return data;
}
