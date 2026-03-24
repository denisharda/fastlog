import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DAILY_WATER_GOAL_ML } from '../constants/hydration';

export interface LocalHydrationLog {
  id: string;
  amount_ml: number;
  logged_at: string;
}

interface HydrationState {
  todayLogs: LocalHydrationLog[];
  dailyGoalMl: number;
  lastResetDate: string; // YYYY-MM-DD — for day-boundary detection
  // Actions
  logWater: (log: LocalHydrationLog) => void;
  removeLog: (logId: string) => void;
  setDailyGoal: (goalMl: number) => void;
  resetIfNewDay: () => void;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export const useHydrationStore = create<HydrationState>()(
  persist(
    (set, get) => ({
      todayLogs: [],
      dailyGoalMl: DEFAULT_DAILY_WATER_GOAL_ML,
      lastResetDate: getTodayDate(),

      logWater: (log) => {
        get().resetIfNewDay();
        set((state) => ({
          todayLogs: [...state.todayLogs, log],
        }));
      },

      removeLog: (logId) =>
        set((state) => ({
          todayLogs: state.todayLogs.filter((l) => l.id !== logId),
        })),

      setDailyGoal: (goalMl) => set({ dailyGoalMl: goalMl }),

      resetIfNewDay: () => {
        const today = getTodayDate();
        if (get().lastResetDate !== today) {
          set({ todayLogs: [], lastResetDate: today });
        }
      },
    }),
    {
      name: 'hydration-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        todayLogs: state.todayLogs,
        dailyGoalMl: state.dailyGoalMl,
        lastResetDate: state.lastResetDate,
      }),
    }
  )
);
