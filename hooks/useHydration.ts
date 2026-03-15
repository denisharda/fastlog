import { useCallback, useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useHydrationStore, LocalHydrationLog } from '../stores/hydrationStore';
import { useFastingStore } from '../stores/fastingStore';
import { useUserStore } from '../stores/userStore';
import { supabase } from '../lib/supabase';
import { trackWaterLogged, trackWaterGoalReached } from '../lib/posthog';

interface SnackbarState {
  visible: boolean;
  message: string;
  lastLog: LocalHydrationLog | null;
}

interface UseHydrationReturn {
  todayTotalMl: number;
  dailyGoalMl: number;
  progressRatio: number;
  logWater: (amountMl: number) => void;
  undoLastLog: () => void;
  subtractLast: () => void;
  setDailyGoal: (goalMl: number) => void;
  snackbar: SnackbarState;
  dismissSnackbar: () => void;
}

export function useHydration(): UseHydrationReturn {
  const {
    todayLogs,
    dailyGoalMl,
    logWater: storeLog,
    removeLog: storeRemove,
    setDailyGoal,
    resetIfNewDay,
  } = useHydrationStore();
  const { activeFast } = useFastingStore();
  const { profile } = useUserStore();

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    visible: false,
    message: '',
    lastLog: null,
  });

  useEffect(() => {
    resetIfNewDay();
  }, [resetIfNewDay]);

  const todayTotalMl = todayLogs.reduce((sum, log) => sum + log.amount_ml, 0);
  const progressRatio = dailyGoalMl > 0 ? Math.min(todayTotalMl / dailyGoalMl, 1) : 0;

  const logWater = useCallback(
    (amountMl: number) => {
      const log: LocalHydrationLog = {
        id: Crypto.randomUUID(),
        amount_ml: amountMl,
        logged_at: new Date().toISOString(),
      };

      storeLog(log);

      const newTotal = todayTotalMl + amountMl;
      trackWaterLogged({ amount_ml: amountMl, total_today_ml: newTotal });

      if (todayTotalMl < dailyGoalMl && newTotal >= dailyGoalMl) {
        trackWaterGoalReached({ goal_ml: dailyGoalMl });
      }

      // Show undo snackbar
      setSnackbar({
        visible: true,
        message: `Added ${amountMl}ml`,
        lastLog: log,
      });

      // Background: insert to Supabase
      if (profile) {
        supabase
          .from('hydration_logs')
          .insert({
            id: log.id,
            user_id: profile.id,
            session_id: activeFast?.sessionId ?? null,
            amount_ml: amountMl,
            logged_at: log.logged_at,
          })
          .then(({ error }) => {
            if (error) console.error('[useHydration] DB insert error:', error);
          });
      }
    },
    [storeLog, profile, activeFast, todayTotalMl, dailyGoalMl]
  );

  const undoLastLog = useCallback(() => {
    if (!snackbar.lastLog) return;

    storeRemove(snackbar.lastLog.id);
    setSnackbar({ visible: false, message: '', lastLog: null });

    // Background: delete from Supabase
    if (profile) {
      supabase
        .from('hydration_logs')
        .delete()
        .eq('id', snackbar.lastLog.id)
        .then(({ error }) => {
          if (error) console.error('[useHydration] DB delete error:', error);
        });
    }
  }, [snackbar.lastLog, storeRemove, profile]);

  const subtractLast = useCallback(() => {
    if (todayLogs.length === 0) return;

    const lastLog = todayLogs[todayLogs.length - 1];
    storeRemove(lastLog.id);

    setSnackbar({
      visible: true,
      message: `Removed ${lastLog.amount_ml}ml`,
      lastLog: null, // No undo for subtract
    });

    // Background: delete from Supabase
    if (profile) {
      supabase
        .from('hydration_logs')
        .delete()
        .eq('id', lastLog.id)
        .then(({ error }) => {
          if (error) console.error('[useHydration] DB delete error:', error);
        });
    }
  }, [todayLogs, storeRemove, profile]);

  const dismissSnackbar = useCallback(() => {
    setSnackbar({ visible: false, message: '', lastLog: null });
  }, []);

  return {
    todayTotalMl,
    dailyGoalMl,
    progressRatio,
    logWater,
    undoLastLog,
    subtractLast,
    setDailyGoal,
    snackbar,
    dismissSnackbar,
  };
}
